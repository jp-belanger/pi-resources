// Adapted from badlogic/pi-subagent shared.ts; see UPSTREAM.md.
import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

/** Parent-owned run metadata; children never write this file. */
export interface SubagentRun {
  version: 1;
  handle: string;
  name?: string;
  parentSessionId: string;
  runDir: string;
  sessionFile: string;
  tmuxSession: string;
  cwd: string;
  provider: string;
  model: string;
  thinking: string;
  trusted: boolean;
  lifecycle: "active" | "suspended" | "stopped";
  generation: string;
  createdAt: string;
}

/** Child-owned runtime state, fenced by launch generation against stale processes. */
export interface SubagentRuntime {
  generation: string;
  state: "idle" | "busy" | "exited" | "error";
  answerEntryId?: string;
  error?: string;
}

/** Durable inbox messages are delivered into the existing child context. */
export interface SubagentInboxMessage {
  message: string;
  delivery: "steer" | "followUp";
  /** Written before dispatch; retained until the tagged user message reaches the branch. */
  dispatch?: {
    generation: string;
    token: string;
    startedAt: number;
    error?: string;
  };
}

/** Persistent workers are kept separate from legacy tmux-subagents artifacts. */
export function subagentRunsDir(): string {
  return join(getAgentDir(), "persistent-subagents");
}

/** Atomic file replacement never creates directories, so late children cannot undo purge. */
export function writeSubagentJson(target: string, value: unknown): void {
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value)}\n`, { mode: 0o600 });
  renameSync(temporary, target);
}

/** Read parent metadata from a known run directory. */
export function readSubagentRun(runDir: string): SubagentRun | undefined {
  try {
    const run = JSON.parse(
      readFileSync(join(runDir, "metadata.json"), "utf8"),
    ) as SubagentRun;
    if (run.version !== 1 || run.runDir !== runDir || !run.parentSessionId)
      return undefined;
    return run;
  } catch {
    return undefined;
  }
}

/** Only the parent replaces metadata; synchronous mutations cannot interleave in its event loop. */
export function writeSubagentRun(run: SubagentRun): void {
  writeSubagentJson(join(run.runDir, "metadata.json"), run);
}

/** Child status from an older launch is ignored. */
export function readSubagentRuntime(
  run: SubagentRun,
): SubagentRuntime | undefined {
  try {
    const runtime = JSON.parse(
      readFileSync(join(run.runDir, `runtime-${run.generation}.json`), "utf8"),
    ) as SubagentRuntime;
    return runtime.generation === run.generation ? runtime : undefined;
  } catch {
    return undefined;
  }
}

/** Management discovery is always scoped to the current parent session. */
export function listSubagentRuns(parentSessionId: string): SubagentRun[] {
  if (!existsSync(subagentRunsDir())) return [];
  return readdirSync(subagentRunsDir(), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readSubagentRun(join(subagentRunsDir(), entry.name)))
    .filter(
      (run): run is SubagentRun => run?.parentSessionId === parentSessionId,
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Validate handles before filesystem lookup and enforce parent ownership. */
export function requireSubagentRun(
  handle: string,
  parentSessionId: string,
): SubagentRun {
  if (!/^[a-f0-9]{12}$/.test(handle))
    throw new Error(`Subagent invalid handle: ${handle}`);
  const run = readSubagentRun(join(subagentRunsDir(), handle));
  if (!run || run.parentSessionId !== parentSessionId)
    throw new Error(`Subagent not found in current parent session: ${handle}`);
  return run;
}

let lastInboxTimestamp = 0;

/** Inbox publication uses atomic rename; pending files prevent stale wait results. */
export function enqueueSubagentMessage(
  run: SubagentRun,
  message: SubagentInboxMessage,
): void {
  const inbox = join(run.runDir, "inbox");
  mkdirSync(inbox, { recursive: true, mode: 0o700 });
  // Parallel tool calls in this parent can publish during the same millisecond.
  lastInboxTimestamp = Math.max(Date.now(), lastInboxTimestamp + 1);
  writeSubagentJson(
    join(inbox, `${lastInboxTimestamp}-${randomUUID()}.json`),
    message,
  );
}

/** Return pending inbox files in publication order. */
export function subagentInboxFiles(run: SubagentRun): string[] {
  const inbox = join(run.runDir, "inbox");
  return existsSync(inbox)
    ? readdirSync(inbox)
        .filter((name) => name.endsWith(".json"))
        .sort()
        .map((name) => join(inbox, name))
    : [];
}

/** Names are single-line labels, not identifiers or tmux targets. */
export function normalizeSubagentName(name: string): string {
  const normalized = name.trim();
  if (
    !normalized ||
    normalized.length > 64 ||
    Array.from(normalized).some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    })
  )
    throw new Error(
      "Subagent name must be a single line of 1 to 64 characters",
    );
  return normalized;
}

interface SessionEntry {
  type: string;
  id: string;
  parentId: string | null;
  message?: {
    role?: string;
    content?: unknown;
    stopReason?: string;
    errorMessage?: string;
  };
}

/** Read a durable assistant answer by settled entry ID, never a previous turn's answer. */
export function readSubagentAnswer(
  run: SubagentRun,
  entryId: string,
): { text: string; failed: boolean } | undefined {
  let content: string;
  try {
    content = readFileSync(run.sessionFile, "utf8");
  } catch {
    return undefined;
  }
  for (const line of content.split("\n")) {
    try {
      const entry = JSON.parse(line) as SessionEntry;
      if (
        entry.id !== entryId ||
        entry.type !== "message" ||
        entry.message?.role !== "assistant"
      )
        continue;
      const message = entry.message;
      const parts: string[] = [];
      if (Array.isArray(message.content)) {
        for (const block of message.content) {
          if (block?.type === "text" && typeof block.text === "string")
            parts.push(block.text);
        }
      }
      const failed =
        message.stopReason === "error" || message.stopReason === "aborted";
      if (message.errorMessage) parts.push(message.errorMessage);
      return { text: parts.join("\n").trim() || "(no response text)", failed };
    } catch {
      /* A final JSONL record may still be being appended. */
    }
  }
  return undefined;
}
