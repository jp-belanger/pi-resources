import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const PANE_STATE_OPTION = "@pi_agent_state";

type AgentBaseState = "waiting" | "working";
type AgentState = AgentBaseState | "blocked";

/** Publishes tmux agent status and rings the terminal bell when Pi needs attention. */
export default function tmuxAgentStatusExtension(pi: ExtensionAPI): void {
  const paneId = process.env.TMUX_PANE;
  let enabled = false;
  let baseState: AgentBaseState = "waiting";
  let waitingForUser = false;
  let tmuxUpdateQueue = Promise.resolve();

  async function runTmux(args: string[]): Promise<boolean> {
    try {
      const result = await pi.exec("tmux", args);
      return result.code === 0;
    } catch {
      return false;
    }
  }

  async function syncTmuxState(state: AgentState | undefined): Promise<void> {
    if (!paneId) return;

    const updated = state
      ? await runTmux([
          "set-option",
          "-p",
          "-t",
          paneId,
          PANE_STATE_OPTION,
          state,
        ])
      : await runTmux([
          "set-option",
          "-p",
          "-u",
          "-t",
          paneId,
          PANE_STATE_OPTION,
        ]);
    if (!updated) return;

    await runTmux(["refresh-client", "-S"]);
  }

  function enqueueTmuxUpdate(state: AgentState | undefined): Promise<void> {
    tmuxUpdateQueue = tmuxUpdateQueue.then(() => syncTmuxState(state));
    return tmuxUpdateQueue;
  }

  function publishCurrentState(): Promise<void> {
    return enqueueTmuxUpdate(waitingForUser ? "blocked" : baseState);
  }

  function ringTerminalBell(): void {
    // tmux forwards BEL to attached terminals; Ghostty requests window attention.
    process.stdout.write("\x07");
  }

  pi.on("session_start", async (_event, ctx) => {
    enabled = ctx.mode === "tui" && Boolean(paneId);
    baseState = "waiting";
    waitingForUser = false;

    if (!enabled) return;

    await publishCurrentState();
  });

  pi.on("before_agent_start", async () => {
    if (!enabled) return;
    baseState = "working";
    await publishCurrentState();
  });

  pi.on("agent_settled", async (event) => {
    if (!enabled) return;
    if (baseState === "working" && !event.aborted) ringTerminalBell();
    baseState = "waiting";
    await publishCurrentState();
  });

  pi.on("ui_prompt_start", async () => {
    if (!enabled) return;
    if (!waitingForUser) ringTerminalBell();
    waitingForUser = true;
    await publishCurrentState();
  });

  pi.on("ui_prompt_end", async () => {
    if (!enabled) return;
    waitingForUser = false;
    await publishCurrentState();
  });

  pi.on("session_shutdown", async () => {
    if (!enabled) return;

    enabled = false;
    waitingForUser = false;
    await enqueueTmuxUpdate(undefined);
  });
}
