# Subagent extension

A worker is a separate Pi session that performs a task for the parent session.
Workers run in parallel and keep their conversation history for later tasks.

**Requirements:** Run this extension in Pi. The `tmux` command must be on `PATH`.
No separate subagent package is necessary.

## Delegate a task

The parent model uses these tools:

| Tool | Function |
| --- | --- |
| `subagent_spawn` | Starts a worker with a `task`. Returns its `handle` immediately. |
| `subagent_send` | Sends a `message` to a worker by `handle`. Uses the same conversation. |
| `subagent_wait` | Waits for the worker to finish and returns its answer. The default timeout is 1800 seconds. |
| `subagent_status` | Shows one worker's state and session path. |
| `subagent_list` | Lists workers for the current parent session. |
| `subagent_rename` | Changes a worker's display name. Keeps its handle. |
| `subagent_stop` | Stops a worker and keeps its history. Prevents automatic restart. |

Use `subagent_spawn` options to set `name`, `cwd`, `provider`, `model`, or `thinking`.
By default, workers use the parent's working directory, provider, model, and thinking level.
For `subagent_send`, use `delivery: "steer"` to guide active work. This is the default.
Use `delivery: "followUp"` to put a message after the current task.

A wait timeout or cancellation does not stop the worker.
Pending messages prevent `subagent_wait` from returning an earlier answer.

**Warning:** `subagent_stop` with `purge: true` permanently deletes the worker's history.

## Open a worker session

Use `/subagent` to select an active worker.
Or run this command in another terminal:

```sh
pi --attach-subagent <handle>
```

## Resume work

- `/reload` does not stop workers.
- Parent exit or session replacement suspends workers and keeps their history.
- When the parent resumes, suspended workers restart idle. Send a new message to continue interrupted work.
- Undelivered messages are archived on suspension. They are not sent again automatically.
- Stopped workers do not restart automatically.

If status reports an unconfirmed-delivery error, inspect the worker session and retained inbox.
Then stop the worker and start a replacement. The system does not retry delivery automatically.

## Access and limits

Workers load normal Pi extensions, skills, and project resources.
Configured permissions control access. Workers are not isolated environments.
Workers cannot create or manage other workers.

Each worker stores its session under `getAgentDir()/persistent-subagents/<handle>/`.
Tool output stops at 50 KB or 2000 lines and includes the full session path.
Workers block `/new`, `/resume`, and `/fork` to keep one session history. `/tree` remains available.
