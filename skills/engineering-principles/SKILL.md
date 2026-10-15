---
name: engineering-principles
description: Select relevant engineering principles before designing, implementing, debugging, refactoring, verifying, or delegating nontrivial work. Read only the applicable principle references for guidance on data shapes, boundaries, simplicity, evidence, and coordination.
---

# Engineering principles

Use the index below to select the principles relevant to the current decision. Read each selected reference in full before applying it. Resolve reference paths relative to this skill directory.

Do not load every principle for every task. Revisit the index when the work changes shape or evidence challenges an assumption. References that name another principle refer to its entry in this index.

Apply these principles alongside the project's instructions and the user's scope. They do not grant permission to expand scope, commit, publish, delete data, or take external actions. Reversible implementation decisions can proceed within the agreed task; product preferences and actions requiring approval still belong to the user.

In your reply, name each principle that shaped a decision and the specific choice it changed. Link each named principle to its reference file. Cite only principles whose reference you read in full this session. Keep the references tied to concrete decisions, not a generic checklist.

The existing `write-discoverable-code` skill remains the implementation standard. Use `how` to understand behavior, `why` to investigate rationale, and `technical-writing` for all writing, including progress updates and replies. Read `../technical-writing/SKILL.md` before drafting prose and follow its writing rules. This skill selects principles; it does not replace those workflows.

## Principle index

### Core

- [Laziness protocol](references/principle-laziness-protocol.md). Refactoring, sizing a diff, or tempted to add abstractions. Bias to deletion and the smallest change that solves the problem.
- [Foundational thinking](references/principle-foundational-thinking.md). Before writing logic: core types, data structures, scaffold sequencing, and what concurrent actors share.
- [Redesign from first principles](references/principle-redesign-from-first-principles.md). Integrating a requirement. Design as if it had been a foundational assumption.
- [Attack the premise](references/principle-attack-the-premise.md). Two fixes sharing a premise fail the same gate. Test the premise before another fix.
- [Subtract before you add](references/principle-subtract-before-you-add.md). Sequencing additions and rewrites. Remove dead weight first.
- [Minimize reader load](references/principle-minimize-reader-load.md). Code is hard to trace. Count layers and hidden state; collapse unnecessary indirection.
- [Outcome-oriented execution](references/principle-outcome-oriented-execution.md). Planned rewrites and migrations. Converge on the target without throwaway compatibility code.
- [Exhaust the design space](references/principle-exhaust-the-design-space.md). Novel interactions or architecture without precedent. Compare competing prototypes.

### Architecture

- [Model the domain](references/principle-model-the-domain.md). Stateful logic, repeated shape assumptions, or scattered branching. Encode the domain in a structure.
- [Boundary discipline](references/principle-boundary-discipline.md). Validation, error handling, and adapters. Guard boundaries and trust internal types.
- [Type system discipline](references/principle-type-system-discipline.md). Types and signatures. Make illegal states unrepresentable and parse external data.
- [Make operations idempotent](references/principle-make-operations-idempotent.md). Commands and lifecycle steps amid retries. Converge despite partial prior runs.
- [Separate before serializing shared state](references/principle-separate-before-serializing-shared-state.md). Concurrent actors write shared state. Eliminate sharing before adding serialization.

### Verification

- [Fix root causes](references/principle-fix-root-causes.md). Debugging. Trace the symptom to the first incorrect state.
- [Sequence verifiable units](references/principle-sequence-verifiable-units.md). Sweeps, migrations, and delivery ordering. Verify each small unit before the next.
- [Test behavior, not implementation](references/principle-test-behavior-not-implementation.md). Writing or reviewing tests. Assert what users observe.

### Delegation

- [Guard the context window](references/principle-guard-the-context-window.md). Large outputs and fan-out. Delegate bulk and retain useful summaries.
