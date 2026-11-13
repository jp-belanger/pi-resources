---
name: create-design-discussion
description: Write a design discussion that lays out the proposed architecture and open design questions, then resolve them with the user.
disable-model-invocation: true
---

# Create a Design Discussion

You are now in the Design Discussion phase. Based on the research findings and the user's change request, work with them to make design decisions.

## Steps to follow after receiving the user's request

1. **Read the files in the task directory and any mentioned files immediately and FULLY**:
   - List `.tasks/{task}/` to find all related documents in the task directory.
   - Ticket files (e.g., `.tasks/eng-1234-description/ticket.md`)
   - Research documents (e.g., `.tasks/eng-1234-description/research.md`)
   - **IMPORTANT**: Read entire files, never partially - if a file is mentioned, read it completely
   - Do not delegate to subagents before reading these files yourself in the main context

2. **Check for related task content**:
   - If a task folder under `.tasks/` is mentioned, list it
   - Read all relevant files in the task directory to fully understand the work so far

3. **Optional - Investigate in parallel for comprehensive research**:
   - If not clear from the research, investigate different aspects concurrently by delegating focused investigations to subagents
   - Pick the right kind of investigation for each question:

   **For deeper investigation:**
   - **Locate** - To find more specific files (e.g., "find all files that handle [specific component]")
   - **Analyze** - To understand implementation details (e.g., "analyze how [system] works")
   - **Find patterns** - To find similar implementation patterns we can model after

   Ask each investigation to:
   - Find the right files and code patterns
   - Identify conventions and patterns to follow
   - Look for integration points and dependencies
   - Return specific file:line references
   - Find tests and examples

   If the user asks you to find how things work or add detail about existing functionality, prefer an initial investigation pass before reading files yourself. If the user gives straightforward feedback that doesn't require loading more codebase context, skip the investigation if you already have the context.

4. **Read the design discussion template and visual guidance**:
   - Use the template in [DESIGN-DISCUSSION-FORMAT.md](./DESIGN-DISCUSSION-FORMAT.md).
   - Follow the [show-me](../show-me/SKILL.md) guidance throughout the design discussion.
   - Use the smallest set of visual views needed to make the current state, proposed end state, and key design choices clear.
   - Place each visual next to the short text it supports. Do not add visuals that do not help the user make a design decision.

5. **Write the design discussion** to `.tasks/{task}/design-discussion.md` at the project root
   - If a task folder for this work already exists, reuse it. Otherwise create it.
   - `{task}` is the ticket ID plus a short slug when there's a ticket, otherwise just the slug, in lowercase kebab-case:
     - With ticket: `.tasks/eng-1478-parent-child-tracking/design-discussion.md`
     - Without ticket: `.tasks/improve-error-handling/design-discussion.md`

### Content guidance

**Outline High-level product spec** - Current state, desired end state, what we're not doing in terms of behavior or functionality.

**Outline the proposed end state architecture** - Use focused before-and-after diagrams, trees, pseudocode, or other views from the `show-me` guidance. Prefer `diff` blocks when the key point is what changes, and show the full target shape when it makes ownership or order clearer.

**Discuss design decisions**
   - For each major design choice, present options with pros/cons
   - Make recommendations based on codebase conventions
   - If the research surfaced testing patterns for the components being changed, include a brief testing approach (e.g. "follow the existing unit test pattern in `__tests__/foo.test.ts`")

**IMPORTANT: All design questions must be written in the OPEN state**
   - Put ALL questions under "Design Questions", NOT under "Resolved Design Questions"
   - You may recommend an option, but you must NOT resolve or close a question yourself
   - Only the user can resolve a design question — through explicit feedback or approval
   - The "Resolved Design Questions" section should be empty in the initial document
   - Do NOT auto-resolve questions even if the answer seems obvious from the research

**Resolving questions after user feedback**
   - When the user provides a clear answer (e.g. "for X we should do Y"), move the question to "Resolved Design Questions"
   - They don't need to say "resolve" explicitly — any clear indication of a decision counts
   - Record the final decision with rationale
   - Record the options that were considered but not chosen, with brief rationale for why they were discarded

**Present patterns to follow**
   - Identify existing patterns in the codebase that should be followed
   - Include file locations and multiline code snippets showing the pattern

6. **Respond** with the path to the design discussion and the open design questions, each with your recommendation. If all design questions have been resolved, say so and list the decisions instead. Do not include a summary or other information.

## Guidance

### Markdown formatting

When writing markdown files that contain code blocks showing other markdown (like README examples or SKILL.md templates), use 4 backticks (````) for the outer fence so inner 3-backtick code blocks don't prematurely close it:

````markdown
# Example README
## Installation
```bash
npm install example
```
````

### Document precedence

When documents conflict, the most recent document wins:
**design discussion > research > ticket**

Decisions made during the design discussion supersede the original ticket description.
The ticket provides the initial request; the design discussion refines and finalizes the approach.
