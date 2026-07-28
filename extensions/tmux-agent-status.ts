import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const PERMISSION_EVENT_CHANNEL = "pi-permission-system:permission-request";
const PANE_STATE_OPTION = "@pi_agent_state";

type AgentBaseState = "waiting" | "working";
type AgentState = AgentBaseState | "blocked";
type PermissionRequestState = "waiting" | "approved" | "denied";

interface PermissionRequestEvent {
  requestId: string;
  state: PermissionRequestState;
}

function isPermissionRequestEvent(
  value: unknown,
): value is PermissionRequestEvent {
  if (typeof value !== "object" || value === null) return false;

  const event = value as Record<string, unknown>;
  return (
    typeof event.requestId === "string" &&
    (event.state === "waiting" ||
      event.state === "approved" ||
      event.state === "denied")
  );
}

export default function tmuxAgentStatusExtension(pi: ExtensionAPI): void {
  const paneId = process.env.TMUX_PANE;
  let enabled = false;
  let baseState: AgentBaseState = "waiting";
  const pendingPermissionRequests = new Set<string>();
  let tmuxUpdateQueue = Promise.resolve();
  let unsubscribePermissionEvents: (() => void) | undefined;

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
    return enqueueTmuxUpdate(
      pendingPermissionRequests.size > 0 ? "blocked" : baseState,
    );
  }

  function handlePermissionEvent(data: unknown): void {
    if (!enabled || !isPermissionRequestEvent(data)) return;

    if (data.state === "waiting") {
      pendingPermissionRequests.add(data.requestId);
    } else {
      pendingPermissionRequests.delete(data.requestId);
    }

    void publishCurrentState();
  }

  pi.on("session_start", async (_event, ctx) => {
    enabled = ctx.mode === "tui" && Boolean(paneId);
    baseState = "waiting";
    pendingPermissionRequests.clear();
    unsubscribePermissionEvents?.();
    unsubscribePermissionEvents = undefined;

    if (!enabled) return;

    unsubscribePermissionEvents = pi.events.on(
      PERMISSION_EVENT_CHANNEL,
      handlePermissionEvent,
    );
    await publishCurrentState();
  });

  pi.on("before_agent_start", async () => {
    if (!enabled) return;
    baseState = "working";
    await publishCurrentState();
  });

  pi.on("agent_settled", async () => {
    if (!enabled) return;
    baseState = "waiting";
    await publishCurrentState();
  });

  pi.on("session_shutdown", async () => {
    unsubscribePermissionEvents?.();
    unsubscribePermissionEvents = undefined;

    if (!enabled) return;

    enabled = false;
    pendingPermissionRequests.clear();
    await enqueueTmuxUpdate(undefined);
  });
}
