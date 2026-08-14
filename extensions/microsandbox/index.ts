import { randomBytes } from "node:crypto";
import { chmod, mkdtemp, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type {
  BashOperations,
  EditOperations,
  ExtensionAPI,
  ExtensionContext,
  FindOperations,
  GrepToolDetails,
  GrepToolInput,
  LsOperations,
  ReadOperations,
  WriteOperations,
} from "@earendil-works/pi-coding-agent";
import {
  createBashTool,
  createEditTool,
  createFindTool,
  createGrepTool,
  createLsTool,
  createReadTool,
  createWriteTool,
  DEFAULT_MAX_BYTES,
  truncateHead,
  truncateLine,
} from "@earendil-works/pi-coding-agent";
import type { FsMetadata, Sandbox, SandboxFsOps } from "microsandbox";
import { loadMicrosandboxConfig, type MicrosandboxConfig } from "./config.ts";
import {
  GUEST_OUTPUT_DIRECTORY,
  GUEST_WORKSPACE,
  guestRelativePath,
  hostCwdToGuest,
  toGuestReadPath,
  toGuestToolPath,
} from "./paths.ts";

const OWNER_LABEL = "pi-microsandbox";
const MAX_NAME_BYTES = 128;
const DEFAULT_GREP_LIMIT = 100;

type MicrosandboxSdk = typeof import("microsandbox");
type State = "starting" | "ready" | "failed" | "stopped" | "unsandboxed";

interface TextResult<T> {
  content: Array<{ type: "text"; text: string }>;
  details: T | undefined;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createSandboxName(sessionId?: string): string {
  const sessionPart = (sessionId ?? "session")
    .replace(/[^a-zA-Z0-9_.-]/g, "-")
    .slice(0, 48);
  const suffix = randomBytes(6).toString("hex");
  return `pi-${sessionPart}-${suffix}`.slice(0, MAX_NAME_BYTES);
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function sandboxLabels(handle: { config(): unknown }): Record<string, string> {
  const config = handle.config() as { labels?: unknown };
  if (!config.labels || typeof config.labels !== "object") return {};
  if (Array.isArray(config.labels)) {
    return Object.fromEntries(
      config.labels.filter(
        (item): item is [string, string] =>
          Array.isArray(item) &&
          typeof item[0] === "string" &&
          typeof item[1] === "string",
      ),
    );
  }
  return config.labels as Record<string, string>;
}

async function removeSandbox(
  sdk: MicrosandboxSdk,
  name: string,
): Promise<void> {
  try {
    const handle = await sdk.Sandbox.get(name);
    if (handle.status === "running" || handle.status === "draining") {
      await handle.stopWithTimeout(5_000);
    }
    await handle.remove();
  } catch {
    try {
      await sdk.Sandbox.remove(name);
    } catch {
      // Cleanup is best-effort. The next startup tries again.
    }
  }
}

async function cleanupStaleSandboxes(sdk: MicrosandboxSdk): Promise<void> {
  let cursor: string | undefined;
  do {
    const page = await sdk.Sandbox.listWith((list) => {
      const configured = list.limit(100).label("owner", OWNER_LABEL);
      return cursor ? configured.cursor(cursor) : configured;
    });
    for (const handle of page.sandboxes) {
      const labels = sandboxLabels(handle);
      const ownerPid = Number.parseInt(labels.hostPid ?? "", 10);
      const staleOwner =
        !Number.isInteger(ownerPid) || !isProcessAlive(ownerPid);
      if (handle.status !== "running" || staleOwner) {
        await removeSandbox(sdk, handle.name);
      }
    }
    cursor = page.nextCursor;
  } while (cursor);
}

async function hardenGuestDevices(
  sandbox: Sandbox,
  guestUser: string,
): Promise<void> {
  const harden = await sandbox.execWith("/bin/bash", (builder) =>
    builder
      .args(["-c", "if [ -e /dev/kvm ]; then chmod 000 /dev/kvm; fi"])
      .user("root")
      .timeout(5_000),
  );
  if (!harden.success) {
    throw new Error(
      `cannot restrict guest /dev/kvm: ${harden.stderr().trim() || `exit ${harden.code}`}`,
    );
  }

  const verify = await sandbox.execWith("/bin/bash", (builder) =>
    builder
      .args(["-c", "test ! -r /dev/kvm && test ! -w /dev/kvm"])
      .user(guestUser)
      .timeout(5_000),
  );
  if (!verify.success) {
    throw new Error(`guest user ${guestUser} can access /dev/kvm`);
  }
}

async function mkdirRecursive(fs: SandboxFsOps, value: string): Promise<void> {
  const guestPath = toGuestToolPath(value);
  if (guestPath === GUEST_WORKSPACE || (await fs.exists(guestPath))) return;
  await mkdirRecursive(fs, path.posix.dirname(guestPath));
  await fs.mkdir(guestPath);
}

function statShape(metadata: FsMetadata): { isDirectory: () => boolean } {
  return { isDirectory: () => metadata.kind === "directory" };
}

function createReadOps(sandbox: Sandbox): ReadOperations {
  const fs = sandbox.fs();
  return {
    readFile: async (value) =>
      Buffer.from(await fs.read(toGuestReadPath(value))),
    access: async (value) => {
      if (!(await fs.exists(toGuestReadPath(value)))) {
        throw new Error(`file does not exist: ${value}`);
      }
    },
    detectImageMimeType: async (value) => {
      const extension = path.posix
        .extname(toGuestReadPath(value))
        .toLowerCase();
      if (extension === ".png") return "image/png";
      if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
      if (extension === ".gif") return "image/gif";
      if (extension === ".webp") return "image/webp";
      return null;
    },
  };
}

function createWriteOps(sandbox: Sandbox): WriteOperations {
  const fs = sandbox.fs();
  return {
    writeFile: async (value, content) => {
      await fs.write(toGuestToolPath(value), content);
    },
    mkdir: async (value) => mkdirRecursive(fs, value),
  };
}

function createEditOps(sandbox: Sandbox): EditOperations {
  const read = createReadOps(sandbox);
  const write = createWriteOps(sandbox);
  return {
    readFile: read.readFile,
    writeFile: write.writeFile,
    access: read.access,
  };
}

function createLsOps(sandbox: Sandbox): LsOperations {
  const fs = sandbox.fs();
  return {
    exists: (value) => fs.exists(toGuestToolPath(value)),
    stat: async (value) => statShape(await fs.stat(toGuestToolPath(value))),
    readdir: async (value) =>
      (await fs.list(toGuestToolPath(value))).map((entry) =>
        path.posix.basename(entry.path),
      ),
  };
}

function createFindOps(
  sandbox: Sandbox,
  config: MicrosandboxConfig,
): FindOperations {
  return {
    exists: (value) => sandbox.fs().exists(toGuestToolPath(value)),
    glob: async (pattern, cwd, options) => {
      const root = toGuestToolPath(cwd);
      const args = ["--files", "--hidden", "--glob", pattern];
      for (const ignored of options.ignore) {
        args.push("--glob", `!${ignored.replaceAll("\\", "/")}`);
      }

      const handle = await sandbox.execStreamWith("rg", (builder) =>
        builder
          .args(args)
          .cwd(root)
          .user(config.guestUser)
          .timeout(config.maxCommandSeconds * 1_000),
      );
      const results: string[] = [];
      let pending = "";
      let stderr = "";
      let exitCode = 0;

      for await (const event of handle) {
        if (event.kind === "stderr") {
          stderr += Buffer.from(event.data).toString();
          continue;
        }
        if (event.kind === "exited") {
          exitCode = event.code;
          continue;
        }
        if (event.kind !== "stdout") continue;

        pending += Buffer.from(event.data).toString();
        for (;;) {
          const newline = pending.indexOf("\n");
          if (newline < 0) break;
          const relativePath = pending.slice(0, newline).replace(/\r$/, "");
          pending = pending.slice(newline + 1);
          if (relativePath) results.push(path.posix.join(root, relativePath));
          if (results.length >= options.limit) {
            await handle.kill();
            return results;
          }
        }
      }

      const finalPath = pending.replace(/\r$/, "");
      if (finalPath && results.length < options.limit) {
        results.push(path.posix.join(root, finalPath));
      }
      if (exitCode !== 0) {
        throw new Error(stderr.trim() || `rg --files exited with ${exitCode}`);
      }
      return results;
    },
  };
}

function commandTimeoutMs(
  requestedSeconds: number | undefined,
  config: MicrosandboxConfig,
): number {
  const requested = requestedSeconds ?? config.maxCommandSeconds;
  return Math.min(requested, config.maxCommandSeconds) * 1_000;
}

function createBashOps(
  sandbox: Sandbox,
  workspace: string,
  config: MicrosandboxConfig,
): BashOperations {
  return {
    exec: async (command, cwd, { onData, signal, timeout }) => {
      if (signal?.aborted) throw new Error("aborted");
      const handle = await sandbox.execStreamWith("/bin/bash", (builder) =>
        builder
          .args(["-lc", command])
          .cwd(hostCwdToGuest(workspace, cwd))
          .user(config.guestUser)
          .timeout(commandTimeoutMs(timeout, config)),
      );
      const abort = () => {
        void handle.kill();
      };
      signal?.addEventListener("abort", abort, { once: true });
      try {
        let exitCode: number | null = null;
        for await (const event of handle) {
          if (event.kind === "stdout" || event.kind === "stderr") {
            onData(Buffer.from(event.data));
          } else if (event.kind === "exited") {
            exitCode = event.code;
          }
        }
        if (signal?.aborted) throw new Error("aborted");
        return { exitCode };
      } finally {
        signal?.removeEventListener("abort", abort);
      }
    },
  };
}

async function executeGrep(
  sandbox: Sandbox,
  config: MicrosandboxConfig,
  params: GrepToolInput,
  signal?: AbortSignal,
): Promise<TextResult<GrepToolDetails>> {
  const limit = Math.max(1, params.limit ?? DEFAULT_GREP_LIMIT);
  const args = ["--line-number", "--color=never", "--hidden"];
  if (params.ignoreCase) args.push("--ignore-case");
  if (params.literal) args.push("--fixed-strings");
  if (params.glob) args.push("--glob", params.glob);
  if (params.context && params.context > 0) {
    args.push("--context", String(params.context));
  }
  args.push("--", params.pattern, guestRelativePath(params.path ?? "."));

  const handle = await sandbox.execStreamWith("rg", (builder) =>
    builder
      .args(args)
      .cwd(GUEST_WORKSPACE)
      .user(config.guestUser)
      .timeout(config.maxCommandSeconds * 1_000),
  );
  const abort = () => {
    void handle.kill();
  };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    let output = "";
    let stderr = "";
    let exitCode = 0;
    for await (const event of handle) {
      if (event.kind === "stdout") output += Buffer.from(event.data).toString();
      if (event.kind === "stderr") stderr += Buffer.from(event.data).toString();
      if (event.kind === "exited") exitCode = event.code;
    }
    if (signal?.aborted) throw new Error("aborted");
    if (exitCode === 1 && output === "") {
      return {
        content: [{ type: "text", text: "No matches found" }],
        details: undefined,
      };
    }
    if (exitCode !== 0)
      throw new Error(stderr.trim() || `rg exited with ${exitCode}`);

    const allLines = output.replace(/\n$/, "").split("\n");
    const limited = allLines.slice(0, limit);
    let linesTruncated = false;
    const normalized = limited.map((line) => {
      const result = truncateLine(line);
      if (result.wasTruncated) linesTruncated = true;
      return result.text;
    });
    const truncation = truncateHead(normalized.join("\n"), {
      maxLines: Number.MAX_SAFE_INTEGER,
      maxBytes: DEFAULT_MAX_BYTES,
    });
    const details: GrepToolDetails = {};
    const notices: string[] = [];
    if (allLines.length > limit) {
      details.matchLimitReached = limit;
      notices.push(`${limit} result lines limit reached`);
    }
    if (linesTruncated) {
      details.linesTruncated = true;
      notices.push("long lines truncated");
    }
    if (truncation.truncated) {
      details.truncation = truncation;
      notices.push("50KB limit reached");
    }
    const text = notices.length
      ? `${truncation.content}\n\n[${notices.join(". ")}]`
      : truncation.content;
    return {
      content: [{ type: "text", text }],
      details: Object.keys(details).length ? details : undefined,
    };
  } finally {
    signal?.removeEventListener("abort", abort);
  }
}

export default function microsandboxExtension(pi: ExtensionAPI): void {
  pi.registerFlag("no-microsandbox", {
    description: "Run Pi tools directly on the host without Microsandbox",
    type: "boolean",
    default: false,
  });

  const localCwd = process.cwd();
  const localRead = createReadTool(localCwd);
  const localWrite = createWriteTool(localCwd);
  const localEdit = createEditTool(localCwd);
  const localBash = createBashTool(localCwd);
  const localLs = createLsTool(localCwd);
  const localFind = createFindTool(localCwd);
  const localGrep = createGrepTool(localCwd);

  let state: State = "stopped";
  let failure: string | undefined;
  let sdk: MicrosandboxSdk | undefined;
  let sandbox: Sandbox | undefined;
  let sandboxName: string | undefined;
  let config: MicrosandboxConfig | undefined;
  let workspace = localCwd;
  let outputDirectory: string | undefined;
  let startPromise: Promise<Sandbox> | undefined;
  let bypass = false;

  function updateStatus(ctx: ExtensionContext): void {
    if (state === "ready") {
      ctx.ui.setStatus("microsandbox", ctx.ui.theme.fg("success", "MICROVM"));
    } else if (state === "unsandboxed") {
      ctx.ui.setStatus("microsandbox", ctx.ui.theme.fg("error", "UNSANDBOXED"));
    } else if (state === "starting") {
      ctx.ui.setStatus(
        "microsandbox",
        ctx.ui.theme.fg("warning", "MICROVM STARTING"),
      );
    } else if (state === "failed") {
      ctx.ui.setStatus(
        "microsandbox",
        ctx.ui.theme.fg("error", "MICROVM FAILED"),
      );
    } else {
      ctx.ui.setStatus("microsandbox", undefined);
    }
  }

  async function stopActive(): Promise<void> {
    const active = sandbox;
    const name = sandboxName;
    const outputs = outputDirectory;
    sandbox = undefined;
    sandboxName = undefined;
    outputDirectory = undefined;
    startPromise = undefined;
    try {
      if (active && name) {
        try {
          await active.stopWithTimeout(5_000);
        } catch {
          // The runtime can remove an ephemeral VM before Pi observes its failure.
        } finally {
          if (sdk) await removeSandbox(sdk, name);
        }
      } else if (name && sdk) {
        await removeSandbox(sdk, name);
      }
    } finally {
      if (outputs) await rm(outputs, { force: true, recursive: true });
    }
  }

  async function start(ctx: ExtensionContext): Promise<Sandbox> {
    if (sandbox && state === "ready") return sandbox;
    if (startPromise) return startPromise;

    state = "starting";
    failure = undefined;
    updateStatus(ctx);
    startPromise = (async () => {
      try {
        config = loadMicrosandboxConfig();
        sdk = await import("microsandbox");
        await cleanupStaleSandboxes(sdk);
        const cachedImage = await sdk.Image.get(config.image);
        if (
          config.imageDigest &&
          cachedImage.manifestDigest !== config.imageDigest
        ) {
          throw new Error(
            `cached image digest mismatch for ${config.image}: expected ${config.imageDigest}, got ${cachedImage.manifestDigest ?? "(none)"}`,
          );
        }
        workspace = path.resolve(ctx.cwd);
        outputDirectory = await mkdtemp(
          path.join(tmpdir(), "pi-microsandbox-output-"),
        );
        await chmod(outputDirectory, 0o700);
        sandboxName = createSandboxName(ctx.sessionManager.getSessionId());
        let builder = sdk.Sandbox.builder(sandboxName)
          .image(config.image)
          .pullPolicy("never")
          .cpus(config.cpus)
          .memory(config.memoryMiB)
          .rootDisk(config.storageMiB)
          .workdir(GUEST_WORKSPACE)
          .shell("/bin/bash")
          .user(config.guestUser)
          .security("restricted")
          .ephemeral(true)
          .labels({
            owner: OWNER_LABEL,
            hostPid: String(process.pid),
            session: ctx.sessionManager.getSessionId(),
          })
          .volume(GUEST_WORKSPACE, (mount) =>
            mount
              .bind(workspace)
              .quota((config as MicrosandboxConfig).workspaceWriteMiB)
              .nosuid()
              .nodev()
              .hostPermissions("private"),
          )
          .volume(GUEST_OUTPUT_DIRECTORY, (mount) =>
            mount
              .bind(outputDirectory as string)
              .readonly()
              .noexec()
              .nosuid()
              .nodev()
              .hostPermissions("private"),
          )
          .network((network) =>
            network
              .policy(sdk?.NetworkPolicy.fromProfiles(["public"]))
              .dns((dns: { rebindProtection(enabled: boolean): unknown }) =>
                dns.rebindProtection(true),
              )
              .onSecretViolation((action: { blockAndTerminate(): unknown }) =>
                action.blockAndTerminate(),
              ),
          );

        if (config.githubPatEnv) {
          const pat = process.env[config.githubPatEnv];
          if (!pat) {
            throw new Error(
              `${config.githubPatEnv} is configured but is not set in the host environment`,
            );
          }
          builder = builder.secret((secret) =>
            secret
              .env("GH_TOKEN")
              .value(pat)
              .allowHost("github.com")
              .allowHost("api.github.com")
              .requireTlsIdentity(true)
              .onViolation((action: { blockAndTerminate(): unknown }) =>
                action.blockAndTerminate(),
              ),
          );
        }

        sandbox = await builder.create();
        await sandbox.ping();
        await hardenGuestDevices(sandbox, config.guestUser);
        state = "ready";
        updateStatus(ctx);
        ctx.ui.notify(
          `Microsandbox ${sandboxName} is ready. ${workspace} is mounted at ${GUEST_WORKSPACE}.`,
          "info",
        );
        return sandbox;
      } catch (error) {
        await stopActive();
        failure = errorText(error);
        state = "failed";
        updateStatus(ctx);
        ctx.ui.notify(`Microsandbox failed closed: ${failure}`, "error");
        throw error;
      } finally {
        startPromise = undefined;
      }
    })();
    return startPromise;
  }

  async function requireSandbox(ctx: ExtensionContext): Promise<Sandbox> {
    if (bypass)
      throw new Error("Microsandbox routing is disabled by explicit flag");
    if (state === "failed") {
      throw new Error(
        `Microsandbox is unavailable; local fallback is disabled: ${failure}`,
      );
    }
    return start(ctx);
  }

  async function recordRuntimeFailure(
    ctx: ExtensionContext,
    active: Sandbox,
    operationError: unknown,
  ): Promise<void> {
    try {
      await active.ping();
    } catch (healthError) {
      failure = `VM health check failed after ${errorText(operationError)}: ${errorText(healthError)}`;
      state = "failed";
      updateStatus(ctx);
      ctx.ui.notify(
        `Microsandbox failed closed: ${failure}. Use /microsandbox-restart.`,
        "error",
      );
    }
  }

  async function isolated<T>(
    ctx: ExtensionContext,
    action: (active: Sandbox) => Promise<T>,
  ): Promise<T> {
    const active = await requireSandbox(ctx);
    try {
      return await action(active);
    } catch (error) {
      await recordRuntimeFailure(ctx, active, error);
      throw error;
    }
  }

  pi.on("session_start", async (_event, ctx) => {
    bypass = pi.getFlag("no-microsandbox") as boolean;
    if (bypass) {
      state = "unsandboxed";
      updateStatus(ctx);
      ctx.ui.notify(
        "UNSANDBOXED: Pi tools will execute directly on the host for this invocation.",
        "warning",
      );
      return;
    }
    try {
      await start(ctx);
    } catch {
      // start() records and displays the fail-closed state.
    }
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    await stopActive();
    state = "stopped";
    updateStatus(ctx);
  });

  pi.registerCommand("microsandbox", {
    description: "Show Microsandbox isolation status",
    handler: async (_args, ctx) => {
      const lines = [
        `State: ${state}`,
        `VM: ${sandboxName ?? "(none)"}`,
        `Workspace: ${workspace} -> ${GUEST_WORKSPACE} (read-write)`,
        `Image: ${config?.image ?? "(configuration unavailable)"}`,
        `Resources: ${config ? `${config.cpus} vCPU, ${config.memoryMiB} MiB RAM, ${config.storageMiB} MiB disk, ${config.workspaceWriteMiB} MiB workspace writes` : "(unknown)"}`,
        "Network: public egress only; no published ports",
        `Secrets: ${config?.githubPatEnv ? "GH_TOKEN placeholder for GitHub" : "(none)"}`,
      ];
      if (failure) lines.push(`Failure: ${failure}`);
      ctx.ui.notify(lines.join("\n"), state === "failed" ? "error" : "info");
    },
  });

  pi.registerCommand("microsandbox-restart", {
    description: "Replace the current Microsandbox VM",
    handler: async (_args, ctx) => {
      if (bypass) {
        ctx.ui.notify(
          "Cannot restart while --no-microsandbox is active",
          "warning",
        );
        return;
      }
      await stopActive();
      state = "stopped";
      try {
        await start(ctx);
      } catch {
        // start() displays the error and keeps tools blocked.
      }
    },
  });

  pi.registerTool({
    ...localRead,
    async execute(id, params, signal, onUpdate, ctx) {
      if (bypass) return localRead.execute(id, params, signal, onUpdate);
      return isolated(ctx, async (active) =>
        createReadTool(GUEST_WORKSPACE, {
          operations: createReadOps(active),
        }).execute(id, params, signal, onUpdate),
      );
    },
  });

  pi.registerTool({
    ...localWrite,
    async execute(id, params, signal, onUpdate, ctx) {
      if (bypass) return localWrite.execute(id, params, signal, onUpdate);
      return isolated(ctx, async (active) =>
        createWriteTool(GUEST_WORKSPACE, {
          operations: createWriteOps(active),
        }).execute(id, params, signal, onUpdate),
      );
    },
  });

  pi.registerTool({
    ...localEdit,
    async execute(id, params, signal, onUpdate, ctx) {
      if (bypass) return localEdit.execute(id, params, signal, onUpdate);
      return isolated(ctx, async (active) =>
        createEditTool(GUEST_WORKSPACE, {
          operations: createEditOps(active),
        }).execute(id, params, signal, onUpdate),
      );
    },
  });

  pi.registerTool({
    ...localBash,
    async execute(id, params, signal, onUpdate, ctx) {
      if (bypass) return localBash.execute(id, params, signal, onUpdate);
      return isolated(ctx, async (active) => {
        const result = await createBashTool(GUEST_WORKSPACE, {
          operations: createBashOps(
            active,
            workspace,
            config as MicrosandboxConfig,
          ),
        }).execute(id, params, signal, onUpdate);
        const hostOutputPath = result.details?.fullOutputPath;
        if (!hostOutputPath || !outputDirectory) return result;

        const filename = path.basename(hostOutputPath);
        const exposedHostPath = path.join(outputDirectory, filename);
        await rename(hostOutputPath, exposedHostPath);
        await chmod(exposedHostPath, 0o444);
        const guestOutputPath = path.posix.join(
          GUEST_OUTPUT_DIRECTORY,
          filename,
        );
        return {
          ...result,
          content: result.content.map((block) =>
            block.type === "text"
              ? {
                  ...block,
                  text: block.text.replaceAll(hostOutputPath, guestOutputPath),
                }
              : block,
          ),
          details: { ...result.details, fullOutputPath: guestOutputPath },
        };
      });
    },
  });

  pi.registerTool({
    ...localLs,
    async execute(id, params, signal, onUpdate, ctx) {
      if (bypass) return localLs.execute(id, params, signal, onUpdate);
      return isolated(ctx, async (active) =>
        createLsTool(GUEST_WORKSPACE, {
          operations: createLsOps(active),
        }).execute(id, params, signal, onUpdate),
      );
    },
  });

  pi.registerTool({
    ...localFind,
    async execute(id, params, signal, onUpdate, ctx) {
      if (bypass) return localFind.execute(id, params, signal, onUpdate);
      return isolated(ctx, async (active) =>
        createFindTool(GUEST_WORKSPACE, {
          operations: createFindOps(active, config as MicrosandboxConfig),
        }).execute(id, params, signal, onUpdate),
      );
    },
  });

  pi.registerTool({
    ...localGrep,
    async execute(_id, params, signal, _onUpdate, ctx) {
      if (bypass) return localGrep.execute(_id, params, signal, _onUpdate);
      return isolated(ctx, async (active) =>
        executeGrep(active, config as MicrosandboxConfig, params, signal),
      );
    },
  });

  pi.on("user_bash", (_event, ctx) => {
    if (bypass) return undefined;
    return {
      operations: {
        exec: async (command, cwd, options) =>
          isolated(ctx, async (active) =>
            createBashOps(active, workspace, config as MicrosandboxConfig).exec(
              command,
              cwd,
              options,
            ),
          ),
      },
    };
  });

  pi.on("before_agent_start", async (event, ctx) => {
    if (bypass) return undefined;
    await requireSandbox(ctx);
    const localLine = `Current working directory: ${workspace}`;
    const guestLine = `Current working directory: ${GUEST_WORKSPACE} (Microsandbox microVM; host workspace mounted read-write from ${workspace})`;
    return {
      systemPrompt: event.systemPrompt.includes(localLine)
        ? event.systemPrompt.replace(localLine, guestLine)
        : `${event.systemPrompt}\n\n${guestLine}`,
    };
  });
}
