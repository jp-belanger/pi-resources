---
description: Turn the current conversation into a spec document
argument-hint: "[spec-name]"
---

Turn the current conversation context and codebase understanding into a spec document. Use the spec name supplied by the user, if any; otherwise infer a concise kebab-case name.

User-supplied spec name: $ARGUMENTS

Write the document to `./<SPEC-NAME>.md` using this template:

# spec: <spec name>

## Requirements
What change we're making and why. Motivation (current behavior + what's wrong), and post-change behavior including edge cases. Note any invariants or compatibility constraints.

## System Architecture
Abstactions, components, boundaries, interfaces, and stores the change touches, and the flow between them.

## Program Design
Key new/changed types and signatures, a call-stack tree (diff syntax for what changes), and a file-tree diff. Prefer pseudocode over prose.

## Vertical slices
Thin end-to-end slices ("tracer bullets"), each independently runnable and reviewable (~100-200 lines).

## Verification
How we'll know it works: tests to add, manual checks, success criteria.

## Consequences / Risks
Trade-offs accepted, backwards-compatibility impact, migration needs.

## Open questions
Anything unresolved, if any.
