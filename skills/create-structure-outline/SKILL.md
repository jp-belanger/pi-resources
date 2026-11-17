---
name: create-structure-outline
description: Write a structure outline that breaks a designed change into vertical, independently verifiable phases, then refine it with the user.
disable-model-invocation: true
---

# Create a Structure Outline

You are creating a structure outline: the phased implementation plan that turns the upstream design into an order of work. It answers IN WHAT ORDER we build it and HOW we know each step works. The structure outline is the change's "C header file": it shows the files, signatures, data shapes, and contracts each phase touches. Implementation writes the function bodies.

## Steps to follow after receiving the user's request

1. **Read the files in the task directory and any mentioned files immediately and FULLY**:
   - List `.tasks/{task}/` to find all related documents. Use the folder the user or session guidance points to. If none is given and you can't tell which task this is, ask the user which artifacts to build the outline from.
   - Read every document in the folder: ticket, research, `design-discussion.md`, `prd.md`, `tdd.md`, and any `diagram-*.html` or `show-me-*.html` files they reference.
   - Read the codebase files those documents mention.
   - **IMPORTANT**: Read entire files, never partially.
   - Do not delegate to subagents before reading these files yourself in the main context.

2. **Learn how this repo verifies changes**:
   - Find the real verification commands: `justfile`, `package.json` scripts, `Makefile`, CI config, and existing test layout.
   - Every phase's automated verification should use these commands, or a test the phase adds. Don't suggest a manual step that a script, test, or existing command could cover.

3. **Optional: investigate in parallel to fill gaps**:
   - If the upstream documents leave a gap that affects phasing, delegate focused investigations to subagents:
     - **Locate**: find more files involved in the change
     - **Analyze**: understand how a specific implementation works
     - **Find patterns**: find similar changes or tests to model phases after
     - **Web research**: check external best practices when the codebase can't answer
   - Ask each investigation to return specific file:line references.
   - Collect each result before you write the outline.

4. **Design the phases**:
   - Break the work into phases that you can verify independently.
   - Order the phases vertically, not horizontally. Wire the thinnest end-to-end path first, then add functionality one slice at a time. Each phase should cross more than one layer, service, or module boundary when possible, so surprises show up early.
   - A phase must never depend on a later phase to be verified.
   - Follow the [engineering](../engineering/SKILL.md) guidance on reviewable changes: keep each phase small enough to review, and ship format or schema changes in a separate phase from risky logic changes when the two can be split.
   - Title each phase with its takeaway, as an outcome rather than a layer: "Phase 2: Operator can replay one dead-lettered message", not "Phase 2: API endpoints".

   A horizontal breakdown creates handoffs and leaves work partly finished:

   ```text
   1. Build the schema
   2. Build the API
   3. Build the UI
   4. Add tests
   ```

   A vertical breakdown cuts through the stack. Each slice includes the schema, API, UI, and tests it needs:

   ```text
   1. User can create the simplest version of the thing end-to-end
   2. User can edit one field end-to-end
   3. User can see the first validation error end-to-end
   ```

   These are illustrations, not a template. Some work doesn't fit this shape, but prefer slices that cross boundaries wherever possible.

5. **Read the template and visual guidance**:
   - Use the template in [STRUCTURE-OUTLINE-FORMAT.md](./STRUCTURE-OUTLINE-FORMAT.md).
   - Follow the [show-me](../show-me/SKILL.md) guidance for every Change Outline.

6. **Write the change outline for each phase**:
   - Show each phase with the smallest set of visual views it needs, not with a list of files and changes.
   - Present each phase in the order that makes it easiest to follow. Show files first when ownership gives the needed context. Show a key data structure, SQL table, or API contract first when it explains the rest of the change.
   - Every view and subheading is optional. Choose and order views to fit the change, not a fixed template.
   - Write it the way one person would explain the change to another. Put a short sentence between views that says why the next shape matters and how it connects to the phase.
   - Use a high-level file-tree diff when file ownership matters. Use focused views for key data structures, SQL tables, or API contracts when those shapes help explain the phase.
   - Use `diff` blocks for focused changes to existing shapes. Use a language-specific or `text` block to show the complete target shape when it is new, high-level, or clearer without diff notation.
   - In file trees, use the tree glyphs `├──`, `└──`, and `│`, not ASCII substitutes. Keep trees small enough to scan: group related files under their shared directory and omit unchanged paths unless they give needed context.
   - In `diff` blocks, start added lines with `+`, removed lines with `-`, and unchanged context lines with a space. A changed line also starts with `+`; mark the change with a trailing `~` note.
   - Add short notes only where they explain ownership or behavior.
   - Show the test changes in the tree when the codebase has a testing pattern for the components being changed (e.g. `+ foo.test.ts   # covers the new behavior`).
   - Prefer signature changes over full code blocks unless the user asks for more.

7. **Write the validation for each phase**:
   - **Automated Verification**: runnable commands from step 2, plus the tests the phase adds.
   - **Manual Verification**: only steps that need human judgment. Not every phase needs one. Don't add manual steps just to fill the section.
   - If you can't verify a phase in any way, it is probably too small or not vertical enough. Merge or reshape it.

8. **Write the structure outline** to `.tasks/{task}/structure-outline.md` at the project root.
   - Reuse the task folder if one already exists. Otherwise create it.
   - `{task}` is the ticket ID plus a short slug when there's a ticket, otherwise just the slug, in lowercase kebab-case:
     - With ticket: `.tasks/eng-1478-parent-child-tracking/structure-outline.md`
     - Without ticket: `.tasks/improve-error-handling/structure-outline.md`
   - Fill in **Implementation Overview** with an unchecked box for every phase title (`- [ ] Phase N: [Title]`). The `implement-outline` skill checks them off and prefixes phase headings with `[DONE]` as phases complete.

9. **Respond** with the path to the structure outline, the Implementation Overview checklist, and any open questions, each with your recommendation. Once no open questions remain, suggest implementing it with the `implement-outline` skill. Do not include a summary or other information.

## Iterate with the user

Treat all user feedback as instructions to update the outline, not to begin implementation.

- Don't accept a factual correction on trust. Read the files or directories the user mentions, delegate a focused investigation if needed, and proceed only once you've verified the facts yourself.
- Rework the affected phases rather than appending to them. If the feedback moves work between phases, update both phases and the Implementation Overview in the same pass.
- After each update, respond with the same shape as step 9.

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

### Keep phases concise but clear

The outline should be concise and easy to read. Include code snippets only where they make a point, and prefer showing signatures over whole code blocks. Reference upstream documents instead of restating them: the PRD owns the WHAT and WHY, the TDD owns the design, and the outline owns the order of work and how each step is verified.

### Document precedence

When documents conflict, the most recent document wins:
**structure outline > TDD > PRD > design discussion > research > ticket**

The structure outline records the final phased approach. If an upstream document suggested something different, the outline reflects the latest decision. If a phasing decision changes the design or user-visible behavior, call it out to the user and update the upstream document.

## Session guidance

Any text below these instructions is the user's guidance for this session. Use it to choose the context you read, the task name, and how to phase the work. Treat its constraints as settled decisions. It changes what the outline covers, not how the session runs.
