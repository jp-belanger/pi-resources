import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

const KEYBINDING_ID = "app.accessMode.toggle";
const DEFAULT_TOGGLE_KEYS = ["ctrl+e"];
const MUTATING_TOOLS = new Set(["edit", "write"]);
const STATE_ENTRY_TYPE = "access-mode";

type AccessMode = "read-only" | "edit";

function readToggleKeys(): string[] {
  const path = join(getAgentDir(), "keybindings.json");
  if (!existsSync(path)) return DEFAULT_TOGGLE_KEYS;

  try {
    const config = JSON.parse(readFileSync(path, "utf8")) as Record<
      string,
      unknown
    >;
    const value = config[KEYBINDING_ID];
    if (typeof value === "string") return [value];
    if (Array.isArray(value) && value.every((item) => typeof item === "string"))
      return value;
  } catch {
    return DEFAULT_TOGGLE_KEYS;
  }

  return DEFAULT_TOGGLE_KEYS;
}

function latestStoredMode(ctx: ExtensionContext): AccessMode | undefined {
  for (const entry of [...ctx.sessionManager.getBranch()].reverse()) {
    if (entry.type !== "custom" || entry.customType !== STATE_ENTRY_TYPE)
      continue;
    const data = entry.data as { mode?: unknown } | undefined;
    if (data?.mode === "read-only" || data?.mode === "edit") return data.mode;
  }
  return undefined;
}

export default function accessModeExtension(pi: ExtensionAPI): void {
  let mode: AccessMode = "read-only";

  function deniedMessage(): string {
    return [
      "Read-only mode is active. The harness denied this file mutation request.",
      "Do not retry edit or write tools. The user has not switched to edit mode yet.",
      "Continue with analysis/planning, or ask the user to enable edit mode.",
    ].join(" ");
  }

  function updateStatus(ctx: ExtensionContext): void {
    const label = mode === "read-only" ? "READ-ONLY" : "EDIT";
    const color = mode === "read-only" ? "warning" : "success";
    ctx.ui.setStatus("access-mode", ctx.ui.theme.fg(color, label));
  }

  function setMode(
    next: AccessMode,
    ctx: ExtensionContext,
    persist: boolean,
  ): void {
    mode = next;
    if (persist) pi.appendEntry(STATE_ENTRY_TYPE, { mode });
    updateStatus(ctx);
    ctx.ui.notify(
      `Access mode: ${mode}`,
      mode === "read-only" ? "warning" : "info",
    );
  }

  function toggleMode(ctx: ExtensionContext): void {
    setMode(mode === "read-only" ? "edit" : "read-only", ctx, true);
  }

  for (const key of readToggleKeys()) {
    pi.registerShortcut(key, {
      description: `Toggle access mode (${KEYBINDING_ID})`,
      handler: (ctx) => toggleMode(ctx),
    });
  }

  pi.on("session_start", async (_event, ctx) => {
    mode = latestStoredMode(ctx) ?? "read-only";
    updateStatus(ctx);
  });

  pi.on("session_tree", async (_event, ctx) => {
    mode = latestStoredMode(ctx) ?? "read-only";
    updateStatus(ctx);
  });

  pi.on("before_agent_start", async (event) => {
    if (mode !== "read-only") return undefined;

    return {
      systemPrompt: `${event.systemPrompt}\n\nAccess mode: READ-ONLY. Do not call edit or write. The user is not ready to start implementation. Continue with analysis, planning, inspection, or clarifying questions only.`,
    };
  });

  pi.on("tool_call", async (event) => {
    if (mode === "read-only" && MUTATING_TOOLS.has(event.toolName)) {
      return { block: true, reason: deniedMessage() };
    }
    return undefined;
  });
}
