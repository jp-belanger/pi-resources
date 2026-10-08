// Persistent worker adaptation of badlogic/pi-subagent; see subagent/UPSTREAM.md.
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, realpathSync, renameSync, rmSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { StringEnum } from "@earendil-works/pi-ai";
import {
  type ExtensionAPI,
  type ExtensionContext,
  truncateHead,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  registerSubagentAttachFlag,
  registerSubagentPicker,
  registerSubagentStatusWidget,
} from "./subagent/attach-picker.ts";
import {
  enqueueSubagentMessage,
  listSubagentRuns,
  normalizeSubagentName,
  readSubagentAnswer,
  readSubagentRuntime,
  requireSubagentRun,
  type SubagentRun,
  subagentInboxFiles,
  subagentRunsDir,
  writeSubagentRun,
} from "./subagent/run-store.ts";
import {
  killSubagentProcess,
  launchSubagentProcess,
  subagentProcessAlive,
  subagentRunState,
} from "./subagent/tmux-process.ts";

const thinkingLevels = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const;
const handleSchema = Type.String({
  description: "Stable handle returned by subagent_spawn",
});

function parentId(ctx: ExtensionContext): string {
  return ctx.sessionManager.getSessionId();
}

function runSummary(run: SubagentRun): string {
  return `${run.name ?? run.handle} (${run.handle}): ${subagentRunState(run)}\nModel: ${run.provider}/${run.model} (${run.thinking})\nAttach: pi --attach-subagent ${run.handle}\nSession: ${run.sessionFile}`;
}

function toolResult(text: string, sessionPath: string) {
  // Reserve space for the suffix so the entire tool result remains under both caps.
  const truncated = truncateHead(text, { maxBytes: 49 * 1024, maxLines: 1995 });
  return {
    content: [
      {
        type: "text" as const,
        text:
          truncated.content +
          (truncated.truncated
            ? `\n[Output truncated at 50KB/2000 lines. Full history: ${sessionPath}]`
            : ""),
      },
    ],
    details: { sessionPath },
  };
}

function selectedModel(
  ctx: ExtensionContext,
  providerOverride?: string,
  modelOverride?: string,
) {
  const explicitProvider = providerOverride?.trim();
  const explicitModel = modelOverride?.trim();
  let provider = explicitProvider || ctx.model?.provider || "";
  let model = explicitModel || ctx.model?.id || "";
  const slash = explicitModel?.indexOf("/") ?? -1;
  if (explicitModel && slash > 0) {
    const prefix = explicitModel.slice(0, slash);
    if (!explicitProvider) {
      provider = prefix;
      model = explicitModel.slice(slash + 1);
    } else if (explicitProvider === prefix)
      model = explicitModel.slice(slash + 1);
  }
  if (!provider || !model)
    throw new Error(
      "Subagent requires an active model or explicit provider and model",
    );
  return { provider, model };
}

function trustedCwd(ctx: ExtensionContext, cwd: string): boolean {
  const rel = relative(realpathSync(ctx.cwd), cwd);
  return (
    ctx.isProjectTrusted() &&
    (rel === "" ||
      (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)))
  );
}

function suspendSubagent(
  run: SubagentRun,
  lifecycle: "suspended" | "stopped",
): void {
  writeSubagentRun({ ...run, lifecycle });
  try {
    killSubagentProcess(run);
  } catch (error) {
    // A failed stop must remain retryable, rather than hiding a live worker as stopped.
    writeSubagentRun(run);
    throw error;
  }
  // Undelivered messages remain inspectable but must not restart work on parent resume.
  const pending = subagentInboxFiles(run);
  if (pending.length) {
    const archive = join(run.runDir, `suspended-inbox-${randomUUID()}`);
    mkdirSync(archive, { mode: 0o700 });
    for (const file of pending)
      renameSync(file, join(archive, file.slice(file.lastIndexOf(sep) + 1)));
  }
}

async function waitDelay(signal?: AbortSignal): Promise<void> {
  if (signal?.aborted)
    throw new Error("Subagent wait cancelled; worker continues running");
  await new Promise<void>((resolveDelay, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("Subagent wait cancelled; worker continues running"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolveDelay();
    }, 250);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** Native persistent subagent tools; child mode deliberately registers no management surface. */
export default function subagentExtension(pi: ExtensionAPI): void {
  // The explicit control-bridge.ts extension owns child lifecycle, even if discovery also loads us.
  if (
    process.env.PI_SUBAGENT_RUN_DIR ||
    process.env.PI_TMUX_SUBAGENT_CHILD === "1"
  )
    return;
  registerSubagentAttachFlag(pi);
  registerSubagentPicker(pi);
  registerSubagentStatusWidget(pi);

  pi.on("session_start", (_event, ctx) => {
    for (const run of listSubagentRuns(parentId(ctx))) {
      if (run.lifecycle !== "suspended" || subagentProcessAlive(run)) continue;
      const resumed: SubagentRun = {
        ...run,
        lifecycle: "active",
        generation: randomUUID(),
      };
      writeSubagentRun(resumed);
      try {
        // tmux may retain a dead pane (remain-on-exit), blocking the same session name.
        killSubagentProcess(resumed);
        launchSubagentProcess(resumed);
      } catch (error) {
        try {
          suspendSubagent(resumed, "suspended");
        } catch (stopError) {
          console.error(
            `Subagent resume cleanup failed for ${run.handle}: ${String(stopError)}`,
          );
        }
        if (ctx.hasUI)
          ctx.ui.notify(
            `Subagent resume failed for ${run.handle}: ${String(error)}`,
            "error",
          );
      }
    }
  });
  pi.on("session_shutdown", (event, ctx) => {
    if (event.reason === "reload") return;
    for (const run of listSubagentRuns(parentId(ctx))) {
      if (run.lifecycle !== "active") continue;
      try {
        suspendSubagent(run, "suspended");
      } catch (error) {
        console.error(
          `Subagent suspension failed for ${run.handle}: ${String(error)}`,
        );
      }
    }
  });

  pi.registerTool({
    name: "subagent_spawn",
    label: "Spawn subagent",
    promptGuidelines: [
      "Delegate independent tasks to subagent_spawn in parallel, then continue useful parent work before waiting.",
    ],
    description:
      "Start a persistent Pi worker in tmux and return its handle immediately, without waiting for model output. Workers run in parallel and keep their context for follow-ups. Normal extensions and permissions load; children cannot delegate. Defaults to the parent's cwd, provider, model and thinking. Use subagent_wait for durable answers.",
    parameters: Type.Object({
      task: Type.String(),
      name: Type.Optional(Type.String()),
      cwd: Type.Optional(Type.String()),
      provider: Type.Optional(Type.String()),
      model: Type.Optional(Type.String()),
      thinking: Type.Optional(StringEnum(thinkingLevels)),
    }),
    async execute(_id, params, signal, _update, ctx) {
      if (signal?.aborted) throw new Error("Subagent spawn cancelled");
      if (!params.task.trim())
        throw new Error("Subagent task must not be empty");
      const cwd = realpathSync(resolve(ctx.cwd, params.cwd?.trim() || "."));
      if (!statSync(cwd).isDirectory())
        throw new Error(`Subagent cwd is not a directory: ${cwd}`);
      const name =
        params.name === undefined
          ? undefined
          : normalizeSubagentName(params.name);
      const model = selectedModel(ctx, params.provider, params.model);
      mkdirSync(subagentRunsDir(), { recursive: true, mode: 0o700 });
      const handle = randomBytes(6).toString("hex");
      const runDir = join(subagentRunsDir(), handle);
      mkdirSync(runDir, { mode: 0o700 });
      const run: SubagentRun = {
        version: 1,
        handle,
        name,
        parentSessionId: parentId(ctx),
        runDir,
        sessionFile: join(runDir, "session.jsonl"),
        tmuxSession: `pi-subagent-${handle}`,
        cwd,
        ...model,
        thinking: params.thinking ?? pi.getThinkingLevel(),
        trusted: trustedCwd(ctx, cwd),
        lifecycle: "active",
        generation: randomUUID(),
        createdAt: new Date().toISOString(),
      };
      writeSubagentRun(run);
      enqueueSubagentMessage(run, {
        message: params.task,
        delivery: "followUp",
      });
      try {
        launchSubagentProcess(run);
      } catch (error) {
        // A timed-out tmux command may still have created the session.
        suspendSubagent(run, "stopped");
        throw error;
      }
      return toolResult(runSummary(run), run.sessionFile);
    },
  });

  pi.registerTool({
    name: "subagent_send",
    label: "Send to subagent",
    description:
      "Send a message into an existing worker's context. steer (default) guides active work; followUp queues behind it. Idle workers start immediately. Returns after durable inbox publication, not after the answer.",
    parameters: Type.Object({
      handle: handleSchema,
      message: Type.String(),
      delivery: Type.Optional(StringEnum(["steer", "followUp"] as const)),
    }),
    async execute(_id, params, _signal, _update, ctx) {
      if (!params.message.trim())
        throw new Error("Subagent message must not be empty");
      const run = requireSubagentRun(params.handle, parentId(ctx));
      if (run.lifecycle !== "active" || !subagentProcessAlive(run))
        throw new Error(`Subagent is not running: ${run.handle}`);
      enqueueSubagentMessage(run, {
        message: params.message,
        delivery: params.delivery ?? "steer",
      });
      return toolResult(`Message queued.\n${runSummary(run)}`, run.sessionFile);
    },
  });

  pi.registerTool({
    name: "subagent_wait",
    label: "Wait for subagent",
    promptGuidelines: [
      "Use subagent_wait to collect durable answers; spawn/send acknowledgements are not completed work.",
    ],
    description:
      "Wait for the worker to settle with no pending inbox messages and return its durable JSONL answer. Cancellation or timeout only stops waiting, never the worker. Output capped at 50KB/2000 lines with full session path.",
    parameters: Type.Object({
      handle: handleSchema,
      timeout: Type.Optional(
        Type.Number({
          minimum: 0,
          maximum: 86400,
          description: "Timeout in seconds; default 1800. Zero polls once.",
        }),
      ),
    }),
    async execute(_id, params, signal, _update, ctx) {
      const deadline = Date.now() + (params.timeout ?? 1800) * 1000;
      while (true) {
        if (signal?.aborted)
          throw new Error("Subagent wait cancelled; worker continues running");
        const run = requireSubagentRun(params.handle, parentId(ctx));
        const state = subagentRunState(run);
        const runtime = readSubagentRuntime(run);
        if (["error", "exited", "stopped", "suspended"].includes(state))
          throw new Error(
            `Subagent cannot finish while ${state}: ${runtime?.error ?? run.handle}\nSession: ${run.sessionFile}`,
          );
        if (state === "idle" && runtime?.answerEntryId) {
          const answer = readSubagentAnswer(run, runtime.answerEntryId);
          if (answer) {
            const result = toolResult(
              `${runSummary(run)}\n\n${answer.text}`,
              run.sessionFile,
            );
            if (answer.failed) throw new Error(result.content[0].text);
            return result;
          }
        }
        if (Date.now() >= deadline)
          return toolResult(
            `Wait timed out; worker was not stopped.\n${runSummary(run)}`,
            run.sessionFile,
          );
        await waitDelay(signal);
      }
    },
  });

  pi.registerTool({
    name: "subagent_status",
    label: "Subagent status",
    description:
      "Inspect a worker's state, model, attach command and durable session path without waiting.",
    parameters: Type.Object({ handle: handleSchema }),
    async execute(_id, params, _signal, _update, ctx) {
      const run = requireSubagentRun(params.handle, parentId(ctx));
      const error = readSubagentRuntime(run)?.error;
      return toolResult(
        runSummary(run) + (error ? `\nError: ${error}` : ""),
        run.sessionFile,
      );
    },
  });
  pi.registerTool({
    name: "subagent_list",
    label: "List subagents",
    description:
      "List workers belonging to the current parent session, including suspended and stopped history. Output capped at 50KB/2000 lines.",
    parameters: Type.Object({}),
    async execute(_id, _params, _signal, _update, ctx) {
      return toolResult(
        listSubagentRuns(parentId(ctx)).map(runSummary).join("\n\n") ||
          "No subagents in this session",
        subagentRunsDir(),
      );
    },
  });
  pi.registerTool({
    name: "subagent_rename",
    label: "Rename subagent",
    description:
      "Change a worker's display name without changing its stable handle or context.",
    parameters: Type.Object({ handle: handleSchema, name: Type.String() }),
    async execute(_id, params, _signal, _update, ctx) {
      const run = {
        ...requireSubagentRun(params.handle, parentId(ctx)),
        name: normalizeSubagentName(params.name),
      };
      writeSubagentRun(run);
      return toolResult(runSummary(run), run.sessionFile);
    },
  });
  pi.registerTool({
    name: "subagent_stop",
    label: "Stop subagent",
    promptGuidelines: [
      "Stop idle subagents when no follow-up work is expected; retain their history unless deletion was requested.",
    ],
    description:
      "Stop a worker and keep its history. Stopped workers do not resume with the parent. Set purge=true to permanently delete this worker's stored transcript and metadata.",
    parameters: Type.Object({
      handle: handleSchema,
      purge: Type.Optional(Type.Boolean()),
    }),
    async execute(_id, params, _signal, _update, ctx) {
      const run = requireSubagentRun(params.handle, parentId(ctx));
      suspendSubagent(run, "stopped");
      if (params.purge) rmSync(run.runDir, { recursive: true, force: true });
      return toolResult(
        params.purge
          ? `Purged subagent ${run.handle}; history deleted`
          : `Stopped subagent ${run.handle}. History: ${run.sessionFile}`,
        run.sessionFile,
      );
    },
  });
}
