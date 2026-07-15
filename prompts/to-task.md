---
description: Turn the current conversation into a task document
argument-hint: "[task-name]"
---

Turn the current conversation context and codebase understanding into a task document. Use the task name supplied by the user, if any; otherwise infer a concise kebab-case name.

User-supplied task name: $ARGUMENTS

Write the document to `docs/tasks/<task-name>.md` using this template:

# Spec: <task name>

## Context
Why this is needed. Current state, problem, constraints. 2-4 sentences.

## Decision / Approach
What we're doing and how, at the level of interfaces and data flow—not implementation detail. Include the one-sentence summary first.

## Scope
- In: ...
- Out (non-goals): ...

## Behavior
Expected behavior, including edge cases and error handling. Bullet per case.

## Verification
How we'll know it works: tests to add, manual checks, success criteria.

## Consequences / Risks
Trade-offs accepted, backwards-compatibility impact, migration needs.

## Alternatives considered
Option → why rejected. One line each.

## Open questions
Anything unresolved, if any.
