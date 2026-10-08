# Persistent subagent provenance

The persistent tmux worker, durable inbox, JSONL answer, attachment picker, and
parent suspend/resume design is locally copied and adapted from
`badlogic/pi-subagent`, commit
`4fc1fe5178d1a2b474794a5ee39e7295844e9d3c` (`index.ts`, `shared.ts`, and
`subagent.ts`). Source: https://github.com/badlogic/pi-subagent/tree/4fc1fe5178d1a2b474794a5ee39e7295844e9d3c.
The source was copied locally for adaptation, not installed as a separate package.
No upstream license file or license declaration was present in that snapshot;
this document does not assign it a license.

Local adaptations:

- Native Pi tools replace the upstream CLI and its skill.
- No tool allowlists or resource-isolation flags; normal permission extensions
  load alongside an explicit child control bridge.
- Preserve the local dedicated tmux socket, current Pi executable invocation,
  `PI_SUBAGENT_PARENT_SESSION`, project-trust flags, and attach entry point.
- Parent metadata and child runtime state have separate writers and launch
  generations. Inbox requests remain pending until their acknowledgement tags
  appear in the child's session branch; answers are read by settled entry ID
  from Pi JSONL. Unconfirmed deliveries are retained rather than replayed.
- Stop retains history unless purge is explicitly requested.

The previous local `extensions/subagent.ts` was adapted from
`mitsuhiko/agent-stuff` commit `0865c849befd2021490679f96a8dee58c84ac857`,
whose source header declared Apache-2.0. The current invocation, socket-aware
attachment, model resolution, and trust behavior retain adaptations of that
local implementation. This note records its attribution without asserting a
license for the separately supplied persistent-worker upstream.
