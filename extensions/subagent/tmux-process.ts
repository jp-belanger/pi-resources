// Adapted from badlogic/pi-subagent shared.ts and the former local subagent.ts.
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import {
  readSubagentRuntime,
  type SubagentRun,
  subagentInboxFiles,
} from "./run-store.ts";

/** All subagent tmux operations use the dedicated agent-directory socket. */
export function subagentTmuxArgs(...args: string[]): string[] {
  return ["-S", join(getAgentDir(), "tmux-subagents.sock"), ...args];
}

/** Check pane liveness, including vanished servers and dead retained panes. */
export function subagentProcessAlive(run: SubagentRun): boolean {
  const result = spawnSync(
    "tmux",
    subagentTmuxArgs(
      "display-message",
      "-p",
      "-t",
      `${run.tmuxSession}:0.0`,
      "#{pane_dead}",
    ),
    { encoding: "utf8", timeout: 5000 },
  );
  return result.status === 0 && result.stdout.trim() === "0";
}

/** Pending inbox messages mask idle, including the interval before child polling. */
export function subagentRunState(run: SubagentRun): string {
  if (run.lifecycle !== "active") return run.lifecycle;
  if (!subagentProcessAlive(run)) return "exited";
  const runtime = readSubagentRuntime(run);
  if (!runtime) return "starting";
  if (runtime.state === "error" || runtime.state === "exited")
    return runtime.state;
  return subagentInboxFiles(run).length ? "busy" : runtime.state;
}

function piInvocation(): string[] {
  const script = process.argv[1];
  if (script && existsSync(script)) return [process.execPath, script];
  return /^(node|bun)(\.exe)?$/i.test(basename(process.execPath))
    ? ["pi"]
    : [process.execPath];
}

/** Relaunch uses stored trust and parent ID; normal extension discovery stays enabled. */
export function launchSubagentProcess(run: SubagentRun): void {
  const result = spawnSync(
    "tmux",
    subagentTmuxArgs(
      "new-session",
      "-d",
      "-s",
      run.tmuxSession,
      "-x",
      "120",
      "-y",
      "40",
      "-c",
      run.cwd,
      "--",
      "env",
      `PI_SUBAGENT_RUN_DIR=${run.runDir}`,
      `PI_SUBAGENT_GENERATION=${run.generation}`,
      `PI_SUBAGENT_PARENT_SESSION=${run.parentSessionId}`,
      ...piInvocation(),
      "--session",
      run.sessionFile,
      "--provider",
      run.provider,
      "--model",
      run.model,
      "--thinking",
      run.thinking,
      run.trusted ? "--approve" : "--no-approve",
      "--extension",
      fileURLToPath(new URL("control-bridge.ts", import.meta.url)),
    ),
    { encoding: "utf8", timeout: 5000 },
  );
  if (result.error || result.status !== 0)
    throw new Error(
      `Subagent tmux launch failed: ${result.error?.message ?? result.stderr.trim()}`,
    );
}

/** Stop only this worker's tmux session, without deleting durable history. */
export function killSubagentProcess(run: SubagentRun): void {
  const result = spawnSync(
    "tmux",
    subagentTmuxArgs("kill-session", "-t", run.tmuxSession),
    { encoding: "utf8", timeout: 5000 },
  );
  if (result.status !== 0 && subagentProcessAlive(run))
    throw new Error(
      `Subagent tmux stop failed: ${result.error?.message ?? result.stderr.trim()}`,
    );
}

/** Same-server attachment switches clients; cross-server attachment clears nesting variables. */
export function subagentAttachOptions(session: string): {
  args: string[];
  env: NodeJS.ProcessEnv;
  sameServer: boolean;
} {
  const sameServer =
    process.env.TMUX?.split(",", 1)[0] ===
    join(getAgentDir(), "tmux-subagents.sock");
  const env = { ...process.env };
  if (!sameServer) {
    delete env.TMUX;
    delete env.TMUX_PANE;
  }
  return {
    args: subagentTmuxArgs(
      sameServer ? "switch-client" : "attach-session",
      "-t",
      session,
    ),
    env,
    sameServer,
  };
}

/** Interactive attachment returns on detach (or immediately after a same-server switch). */
export async function attachSubagentProcess(session: string): Promise<boolean> {
  const { args, env } = subagentAttachOptions(session);
  return new Promise((resolve) => {
    const child = spawn("tmux", args, { stdio: "inherit", env });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}
