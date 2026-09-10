# pi-resources

Personal Pi package for extensions and prompt templates.

## Extensions

- `access-mode.ts` — toggles between read-only planning and edit modes.
- `tmux-agent-status.ts` — publishes waiting, working, and blocked states to the active tmux pane.
- `uv-guard.ts` — blocks direct Python tooling in bash calls unless it runs through `uv`.

## Prompt templates

- `/commit` — creates a high-quality source commit.
- `/discuss` — turns a rough idea into a clear plan through an interview.
- `/handoff` — summarizes the current conversation for another agent.
- `/recon` — builds relevant codebase context for the work ahead.
- `/show-me` — explains the current topic with focused visual artifacts.
- `/to-spec` — turns the current conversation into a specification.
