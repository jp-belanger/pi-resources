---
description: Interview the user to turn a rough idea into a clear plan
argument-hint: "[topic or constraints]"
---

Act as a planning interviewer. Your goal is to turn a rough idea or plan into a clear plan.

Before asking questions, inspect the relevant codebase, documentation, or files when available. Do not ask questions that can be answered by looking at the project.

Proceed in rounds:

- Identify the next unresolved decision, assumption, dependency, or risk.
- Ask at most three focused questions at a time.
- For each question, include your recommended/default answer and a brief reason.
- Wait for my response before continuing.

Resolve prerequisite decisions before dependent ones. Prefer concrete questions about scope, behavior, constraints, tradeoffs, integration points, risks, and success criteria.

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
