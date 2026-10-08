# pi-resources

Personal Pi package for extensions, skills, and prompt templates.

## Extensions

- `subagent.ts` — native tools for parallel, persistent Pi workers in tmux (see below).
- `tmux-agent-status.ts` — publishes waiting, working, and blocked states to the active tmux pane; rings the terminal bell when a run finishes (unless cancelled) or an input dialog opens, allowing Ghostty to request Sway workspace attention.
- `uv-guard.ts` — blocks direct Python tooling in bash calls unless it runs through `uv`.

## Persistent subagents

Requires Pi and `tmux` on `PATH`; no separate subagent CLI or external package
installation is needed. The parent model receives these native tools:

- `subagent_spawn`: takes `task` and optional `name`, `cwd`, `provider`, `model`,
  and `thinking`; returns a stable handle immediately. Workers run independently
  in parallel rather than serializing delegated tasks.
- `subagent_send`: takes `handle`, `message`, and optional `delivery` (`steer` by
  default, or `followUp`). Reuses the worker's conversation context.
- `subagent_wait`: takes `handle` and optional `timeout` in seconds (default
  1800); returns the settled answer from durable Pi JSONL. Cancellation and
  timeout do **not** kill the worker. Pending messages prevent stale answers.
- `subagent_status`, `subagent_list`, `subagent_rename`: inspect the current
  parent's workers or change a display name without changing its handle.
- `subagent_stop`: retains history and prevents automatic resume. Optional
  `purge: true` permanently deletes the worker's history.

Use `/subagent` to pick and attach to an active worker, or run
`pi --attach-subagent <handle>` in another terminal. Legacy UUID attach targets
still work. All operations use `getAgentDir()/tmux-subagents.sock`; attachment
switches clients on the same socket and clears tmux nesting variables when
attaching across servers. The picker suspends the parent terminal UI while an
attached child owns the terminal. The parent TUI shows names and states for up to
five active workers (plus an overflow count); no widget runs in RPC/print mode.

Workers survive `/reload`. Parent quit or session replacement suspends them,
keeping history; resuming the parent relaunches suspended workers idle. In-flight
work is interrupted, not automatically replayed: send a new message to continue.
Undelivered inbox messages are archived on suspension for inspection. Stopped
workers are never automatically relaunched.

Inbox files retain per-message dispatch markers across reload until a tagged user
message appears on the child's session branch. Idle prompt starts are serialized;
queued follow-ups do not block steering active work. A small `[subagent inbox: …]`
tag is included in delivered prompts for unambiguous acknowledgement. Delivery is
not exactly-once: if preflight fails, an input extension consumes/removes the tag,
or reload loses a queued prompt, the request stays pending rather than replaying
or exposing an old answer. After 30 seconds while idle with no Pi queue, status
reports an unconfirmed-delivery error. Inspect the attached child and retained
inbox, then stop and spawn a replacement worker; there is no automatic retry.
Long-running queued work is not subject to this idle timeout.

Each worker uses a dedicated JSONL session under
`getAgentDir()/persistent-subagents/<handle>/`, separate from old
`tmux-subagents` artifacts. Tool output is capped at 50KB/2000 lines and includes
the full session path. Management tools are scoped to the current parent session.
Managed children block `/new`, `/resume`, and `/fork` to preserve that dedicated
transcript; `/tree` remains available.

Children load normal extensions, skills, and project resources alongside an
explicit control bridge, but do not receive subagent management tools. There are
no tool restriction or isolation options: configured permissions govern access.
Trusted same/descendant working directories use `--approve`; others use
`--no-approve`. That choice and `PI_SUBAGENT_PARENT_SESSION` are preserved on
resume, without importing any particular permission package.

Upstream provenance and local adaptations are recorded in
[`extensions/subagent/UPSTREAM.md`](extensions/subagent/UPSTREAM.md).

## Skills

- `readable-tests` — language-independent expect testing for results, events, state, wire output, and diagnostics, demonstrated with Rust examples.
- `write-discoverable-code` — naming and organization conventions that make code easy to find through plain-text search.

## Prompt templates

- `/commit` — creates a high-quality source commit.
- `/discuss` — turns a rough idea into a clear plan through an interview.
- `/handoff` — summarizes the current conversation for another agent.
- `/recon` — builds relevant codebase context for the work ahead.
- `/show-me` — explains the current topic with focused visual artifacts.
- `/to-spec` — turns the current conversation into a specification.
