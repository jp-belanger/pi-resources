---
name: new-task
description: Interview the user about a proposed task before implementation
---

# New Task

Interview the user until you reach a shared understanding.

1. First, explore the codebase to answer anything you can yourself: existing patterns, conventions, related code, constraints. Never ask a question the code can answer.
2. Interview the user one question at a time, in dependency order — resolve decisions that other decisions hinge on first, walking down each branch of the design tree before moving to the next.
3. For each question: concisely state the trade-offs and your recommended answer with reasoning, and let the user answer.
4. Cover at minimum: scope and non-goals, expected behavior, invariants and edge cases, evaluation suite, context boundaries, interfaces/APIs affected, error handling, and backwards compatibility.
5. Stop when remaining questions wouldn't change the implementation. Ask the user if the decisions should be documented.
6. If the user wants the decision documented:
    1. Summarize the task using the template at [task.md](./task.md) and write it to docs/tasks/<task-name>.md.
    2. If the task involves a significant engineering decision (hard to reverse, result of a real trade-off), propose an ADR. On confirmation, write it using the template at [adr.md](./adr.md) to docs/adr/NNNN-<title>.md and link it from the task.

Task: $ARGUMENTS
