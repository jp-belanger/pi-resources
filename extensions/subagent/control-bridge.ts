// Adapted from badlogic/pi-subagent index.ts; see UPSTREAM.md.
import { randomUUID } from "node:crypto";
import { readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  readSubagentRun,
  type SubagentInboxMessage,
  type SubagentRuntime,
  subagentInboxFiles,
  writeSubagentJson,
} from "./run-store.ts";

/** Explicit child control bridge; no management tools or resource discovery changes. */
export default function subagentControlBridge(pi: ExtensionAPI): void {
  const runDir = process.env.PI_SUBAGENT_RUN_DIR;
  const generation = process.env.PI_SUBAGENT_GENERATION;
  if (!runDir || !generation) return;
  let context: ExtensionContext | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let sessionName: string | undefined;
  let settled = false;
  let runtime: SubagentRuntime = { generation, state: "idle" };

  const saveRuntime = (patch: Partial<SubagentRuntime>): void => {
    const run = readSubagentRun(runDir);
    if (!run || run.generation !== generation) return;
    runtime = { ...runtime, ...patch };
    try {
      writeSubagentJson(join(runDir, `runtime-${generation}.json`), runtime);
    } catch (error) {
      // Purge can race the metadata read; never recreate its directory.
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  };
  const publishState = (ctx: ExtensionContext): void => {
    const run = readSubagentRun(runDir);
    if (!run || run.generation !== generation) return;
    if (subagentInboxFiles(run).length) return;
    const idle = settled && ctx.isIdle() && !ctx.hasPendingMessages();
    const last = ctx.sessionManager
      .getBranch()
      .toReversed()
      .find((entry) => entry.type === "message");
    saveRuntime({
      state: idle ? "idle" : "busy",
      answerEntryId:
        idle &&
        last?.type === "message" &&
        last.message.role === "assistant" &&
        last.message.stopReason !== "toolUse"
          ? last.id
          : undefined,
      error: undefined,
    });
  };

  const processInbox = (): void => {
    if (!context) return;
    const run = readSubagentRun(runDir);
    if (!run || run.generation !== generation || run.lifecycle !== "active")
      return;
    try {
      const nextName = `subagent ${run.name ?? run.handle}`;
      if (nextName !== sessionName) {
        pi.setSessionName(nextName);
        sessionName = nextName;
      }
      const pending = subagentInboxFiles(run).map((file) => ({
        file,
        value: JSON.parse(readFileSync(file, "utf8")) as SubagentInboxMessage,
      }));
      // Poll the branch, not message_end: its handlers run BEFORE Pi appends the entry.
      const userTexts = context.sessionManager
        .getBranch()
        .flatMap((entry) =>
          entry.type === "message" && entry.message.role === "user"
            ? typeof entry.message.content === "string"
              ? [entry.message.content]
              : entry.message.content.flatMap((block) =>
                  block.type === "text" ? [block.text] : [],
                )
            : [],
        );
      let awaitingAcceptance = false;
      let deliveryError: string | undefined;
      for (const { file, value } of pending) {
        if (
          typeof value.message !== "string" ||
          !["steer", "followUp"].includes(value.delivery)
        )
          throw new Error("Subagent invalid inbox message");
        const dispatch = value.dispatch;
        if (!dispatch) continue;
        if (
          userTexts.some((text) =>
            text.includes(`[subagent inbox: ${dispatch.token}]`),
          )
        ) {
          // Busy is durable before the last pending marker disappears.
          saveRuntime({
            state: "busy",
            answerEntryId: undefined,
            error: undefined,
          });
          unlinkSync(file);
          continue;
        }
        awaitingAcceptance = true;
        if (
          !dispatch.error &&
          (dispatch.generation !== generation ||
            (context.isIdle() &&
              !context.hasPendingMessages() &&
              Date.now() - dispatch.startedAt >= 30_000))
        ) {
          dispatch.error =
            "Subagent delivery unconfirmed: no matching user message reached the session branch. Request retained, not retried; inspect the child for preflight/auth/input-hook errors, then stop and spawn a replacement worker.";
          writeSubagentJson(file, value);
        }
        deliveryError ??= dispatch.error;
      }
      if (deliveryError) {
        saveRuntime({
          state: "error",
          answerEntryId: undefined,
          error: deliveryError,
        });
        return;
      }
      for (const { file, value } of pending) {
        if (value.dispatch) continue;
        // Serialize idle preflight. During active work, a queued follow-up must not
        // prevent a later steer from entering Pi's independent steering queue.
        if (
          context.isIdle() &&
          (awaitingAcceptance || context.hasPendingMessages())
        )
          break;
        value.dispatch = {
          generation,
          token: randomUUID(),
          startedAt: Date.now(),
        };
        writeSubagentJson(file, value);
        saveRuntime({
          state: "busy",
          answerEntryId: undefined,
          error: undefined,
        });
        awaitingAcceptance = true;
        try {
          // This API returns void; neither success nor async rejection acknowledges delivery.
          pi.sendUserMessage(
            `${value.message}\n\n[subagent inbox: ${value.dispatch.token}]`,
            { deliverAs: value.delivery },
          );
        } catch (error) {
          value.dispatch.error = `Subagent delivery failed: ${String(error)}. Request retained, not retried.`;
          writeSubagentJson(file, value);
          throw error;
        }
      }
      publishState(context);
    } catch (error) {
      saveRuntime({
        state: "error",
        answerEntryId: undefined,
        error: String(error),
      });
    }
  };

  pi.on("session_start", (_event, ctx) => {
    context = ctx;
    settled = ctx.isIdle() && !ctx.hasPendingMessages();
    saveRuntime({ state: "busy", answerEntryId: undefined, error: undefined });
    publishState(ctx);
  });
  // Resource discovery follows permission setup; never start prompts before it completes.
  pi.on("resources_discover", () => {
    if (!context || timer) return;
    timer = setInterval(processInbox, 250);
    timer.unref();
  });
  pi.on("agent_start", (_event, ctx) => {
    context = ctx;
    settled = false;
    saveRuntime({ state: "busy", answerEntryId: undefined, error: undefined });
  });
  pi.on("agent_settled", (_event, ctx) => {
    context = ctx;
    settled = true;
    publishState(ctx);
  });
  pi.on("session_tree", (_event, ctx) => {
    context = ctx;
    settled = ctx.isIdle() && !ctx.hasPendingMessages();
    publishState(ctx);
  });
  const blockSessionReplacement = (ctx: ExtensionContext) => {
    ctx.ui.notify(
      "Subagent session replacement is disabled: this worker owns a dedicated transcript. Use /tree or spawn another worker.",
      "warning",
    );
    return { cancel: true };
  };
  pi.on("session_before_switch", (_event, ctx) => blockSessionReplacement(ctx));
  pi.on("session_before_fork", (_event, ctx) => blockSessionReplacement(ctx));
  pi.on("session_shutdown", (event) => {
    context = undefined;
    if (timer) clearInterval(timer);
    timer = undefined;
    if (event.reason !== "reload") saveRuntime({ state: "exited" });
  });
}
