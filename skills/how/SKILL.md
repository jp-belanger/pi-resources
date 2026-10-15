---
name: how
description: "Use for \"how does X work\", code walkthroughs before changing something, and placement / ownership / layering questions (\"where should this live\", \"which package owns this\", \"is this the right layer\"). Explains subsystem architecture, runtime flow, onboarding mental models. Use why for motivation."
disable-model-invocation: true
---

# How

Explore the codebase to answer "how does X work?" questions. Produce architectural explanations at the level of a senior engineer onboarding onto a subsystem, enough to build a working mental model, not so much that it reads like annotated source code.

The parent orchestrates workers with `subagent_spawn` and collects each result with `subagent_wait` using its returned handle. Spawn independent workers before waiting so they run in parallel. Omit `provider`, `model`, and `thinking` to inherit the current configuration unless the user explicitly selects them. Instruct every worker to investigate without modifying files; these tools do not provide a readonly restriction.

Workers do not receive subagent management tools. If this skill is running inside a worker, perform the assigned explorer or explainer role inline and return its findings to the parent; do not attempt nested delegation. The parent owns all exploration and synthesis spawns. Resolve reference paths relative to this skill directory and include the relevant templates in each worker's task.

## 1. Assess complexity

If the scope is ambiguous, state your interpretation and explore. The user can redirect.

- **Simple** (a single module, a small utility, a narrow question such as "how does function X work"): no explorers. Spawn one explainer that explores and explains in one pass, built from `references/explainer-prompt.md` without the explorer-findings section. Go to step 4.
- **Complex** (a subsystem spanning multiple files or services, a cross-cutting feature, a full architectural overview): go to step 2.

When in doubt, take the simple path.

## 2. Explore (complex only)

Decompose the question into 2 to 4 angles, each a distinct slice of the subsystem. Spawn all explorers with `subagent_spawn` before waiting, each with `references/explorer-prompt.md` and its angle filled in.

## 3. Synthesize (complex only)

Once `subagent_wait` has returned every explorer's findings, spawn one explainer with `references/explainer-prompt.md` and every explorer's findings filled in.

## 4. Present

Collect the explainer's output with `subagent_wait` and present it. Light edits for clarity or context from the conversation are fine. Do not substantially rewrite it.

## Output format

The explanation uses the sections defined in `references/explainer-prompt.md`, dropping any that do not apply: Overview, Key Concepts, How It Works, Where Things Live, Gotchas.
