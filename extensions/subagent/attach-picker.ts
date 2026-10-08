// Adapted from badlogic/pi-subagent index.ts; see UPSTREAM.md.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { SelectList, type TUI } from "@earendil-works/pi-tui";
import {
  listSubagentRuns,
  readSubagentRun,
  subagentRunsDir,
} from "./run-store.ts";
import {
  attachSubagentProcess,
  subagentAttachOptions,
  subagentProcessAlive,
  subagentRunState,
} from "./tmux-process.ts";

/** Preserve pi --attach-subagent, including legacy UUID targets on the dedicated socket. */
export function registerSubagentAttachFlag(pi: ExtensionAPI): void {
  pi.registerFlag("attach-subagent", {
    description: "Attach to a persistent subagent handle",
    type: "string",
  });
  let target: string | undefined;
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === "--") break;
    if (arg === "--attach-subagent") {
      target = process.argv[i + 1] ?? "";
      break;
    }
    if (arg.startsWith("--attach-subagent=")) {
      target = arg.slice("--attach-subagent=".length);
      break;
    }
  }
  if (target === undefined) return;
  let session: string | undefined;
  if (/^[a-f0-9]{12}$/.test(target))
    session = readSubagentRun(join(subagentRunsDir(), target))?.tmuxSession;
  else if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      target,
    )
  )
    session = `pi-agent-${target}`;
  if (!session) {
    console.error(`Subagent attach target is invalid or unknown: ${target}`);
    process.exit(2);
  }
  const { args, env } = subagentAttachOptions(session);
  const result = spawnSync("tmux", args, { stdio: "inherit", env });
  if (result.error)
    console.error(`Subagent attach failed: ${result.error.message}`);
  process.exit(result.status ?? 1);
}

/** Parent status widget is TUI-only; reload and shutdown release its polling timer. */
export function registerSubagentStatusWidget(pi: ExtensionAPI): void {
  let timer: ReturnType<typeof setInterval> | undefined;
  let context: ExtensionContext | undefined;
  let previous: string | undefined;
  const stopWidget = (): void => {
    if (timer) clearInterval(timer);
    timer = undefined;
    context?.ui.setWidget("subagent-status", undefined);
    context = undefined;
    previous = undefined;
  };
  pi.on("session_start", (_event, ctx) => {
    stopWidget();
    if (ctx.mode !== "tui") return;
    context = ctx;
    const refreshWidget = (): void => {
      const runs = listSubagentRuns(ctx.sessionManager.getSessionId()).filter(
        (run) => run.lifecycle === "active",
      );
      const lines = runs
        .slice(0, 5)
        .map((run) => `  ${run.name ?? run.handle} · ${subagentRunState(run)}`);
      if (runs.length > 5) lines.push(`  +${runs.length - 5} more (/subagent)`);
      const text = lines.join("\n");
      if (text === previous) return;
      previous = text;
      ctx.ui.setWidget(
        "subagent-status",
        lines.length ? ["Subagents", ...lines] : undefined,
      );
    };
    refreshWidget();
    timer = setInterval(refreshWidget, 1000);
    timer.unref();
  });
  pi.on("session_shutdown", stopWidget);
}

/** Attach picker scopes runs to this parent and suspends terminal input during attachment. */
export function registerSubagentPicker(pi: ExtensionAPI): void {
  pi.registerCommand("subagent", {
    description: "Select and attach to a persistent subagent",
    handler: async (_args, ctx) => {
      if (ctx.mode !== "tui") {
        ctx.ui.notify("Subagent picker requires TUI mode", "warning");
        return;
      }
      const runs = listSubagentRuns(ctx.sessionManager.getSessionId()).filter(
        (run) => run.lifecycle === "active" && subagentProcessAlive(run),
      );
      if (!runs.length) {
        ctx.ui.notify("No active subagents in this session", "info");
        return;
      }
      let tui: TUI | undefined;
      const selected = await ctx.ui.custom<string | undefined>(
        (customTui, theme, _keys, done) => {
          tui = customTui;
          const list = new SelectList(
            runs.map((run) => ({
              value: run.handle,
              label: `${run.name ?? run.handle} (${run.handle}) · ${subagentRunState(run)} · ${run.provider}/${run.model}`,
            })),
            Math.min(runs.length, 10),
            {
              selectedPrefix: (text) => theme.fg("accent", text),
              selectedText: (text) => theme.fg("accent", text),
              description: (text) => theme.fg("muted", text),
              scrollInfo: (text) => theme.fg("dim", text),
              noMatch: (text) => theme.fg("warning", text),
            },
          );
          list.onSelect = (item) => done(item.value);
          list.onCancel = () => done(undefined);
          return {
            render: (width) => list.render(width),
            invalidate: () => list.invalidate(),
            handleInput: (data) => {
              list.handleInput(data);
              customTui.requestRender();
            },
          };
        },
      );
      const run = runs.find((candidate) => candidate.handle === selected);
      if (!run || !tui) return;
      tui.stop();
      try {
        if (!(await attachSubagentProcess(run.tmuxSession)))
          process.stderr.write(`Subagent attach failed: ${run.handle}\n`);
      } finally {
        tui.start();
        tui.requestRender(true);
      }
    },
  });
}
