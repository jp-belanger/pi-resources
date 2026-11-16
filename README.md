# pi-resources

A personal Pi package with extensions, skills, and prompt templates.
Extensions add tools and terminal features. Skills guide the model's work.
Prompt templates define reusable tasks.

## Extensions

The extension documents contain requirements, usage instructions, and limits.

| Extension | Purpose | Source |
| --- | --- | --- |
| [Subagent](extensions/subagent/README.md) | Runs persistent Pi workers in parallel through tmux. | [`subagent.ts`](extensions/subagent.ts) |
| [tmux agent status](extensions/tmux-agent-status.ts) | Reports agent state to tmux and sends terminal bell notifications. | [`tmux-agent-status.ts`](extensions/tmux-agent-status.ts) |

## Skills

Each skill file defines its scope and instructions.

| Skill | Purpose |
| --- | --- |
| [create-design-discussion](skills/create-design-discussion/SKILL.md) | Lays out a proposed architecture and open design questions, then resolves them with the user. |
| [create-prd](skills/create-prd/SKILL.md) | Writes a product requirements document through a guided interview. |
| [create-structure-outline](skills/create-structure-outline/SKILL.md) | Breaks a designed change into vertical, independently verifiable phases. |
| [create-tdd](skills/create-tdd/SKILL.md) | Writes a technical design document through a guided interview. |
| [domain-modeling](skills/domain-modeling/SKILL.md) | Defines domain terms, maintains glossaries, and records architecture decisions. |
| [engineering](skills/engineering/SKILL.md) | Guides software design, implementation, and verification. |
| [implement-outline](skills/implement-outline/SKILL.md) | Implements a structure outline phase by phase through workers, with a review and commit between phases. |
| [show-me](skills/show-me/SKILL.md) | Explains topics with diagrams, code examples, and HTML documents. |
| [write-discoverable-code](skills/write-discoverable-code/SKILL.md) | Defines naming and organization rules that help readers find code through text search. |

## Prompt templates

| Template | Purpose |
| --- | --- |
| [/commit](prompts/commit.md) | Creates a Git commit for selected changes without pushing. |
| [/discuss](prompts/discuss.md) | Turns an idea into a plan without implementation. |
| [/say-again](prompts/say-again.md) | Restates the last response in plain language. |
