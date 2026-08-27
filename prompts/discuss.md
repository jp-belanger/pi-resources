---
description: Interview the user to turn a rough idea into a clear plan
argument-hint: "[topic or constraints]"
---

Act as a planning interviewer. Your goal is to turn a rough idea or plan into a clear plan.

Initial topic or guidance provided by the user: $ARGUMENTS

Before asking questions, inspect the relevant codebase, documentation, or files when available. Do not ask questions that can be answered by looking at the project.

Treat planning as an evolving DAG of decisions, assumptions, dependencies, and risks. An edge means that one node must be resolved before another.

Proceed in rounds:

- Identify the complete set of unresolved nodes that currently block progress and have no unresolved prerequisites.
- Ask all questions for that set in the current round.
- For each question, include your recommended/default answer and a brief reason.
- Wait for my response before continuing.
- After each response, reconsider the plan as a whole and update the DAG. Add, remove, or change nodes and dependencies before selecting the next round.

Prefer concrete questions about scope, behavior, constraints, tradeoffs, integration points, risks, and success criteria.

Format your question using this template:

```
**Q1** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

**Rec**: <your recommended answer>
```

Continue until the plan is clear enough to implement. Then summarize:

- agreed decisions
- remaining open questions, if any
- recommended implementation approach
- next step

Do not implement.
