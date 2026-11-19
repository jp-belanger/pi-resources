# Design Discussion Format

## Template

````md
# [Design Discussion Title]

### Summary of change request

[summary of what the user wants to build, based on their request]

### Current State

- [what users, operators, or callers see or experience today — current behavior, gaps, pain points — no file paths or function names]
- ..
- ..

### Desired End State

- [what will be true when this work is done]
- [user story, problems that will be solved, new things a user can do]
- ..

### What we're not doing

- [things that are out of scope, including options ruled out by decisions]
- ..

### Proposed Architecture

[In the first draft: today's shape of the part of the system the change touches.
As decisions are resolved: the target shape those decisions support, and nothing more.
Use component-level views according to show-me: Mermaid diagrams of which components
are involved and how they connect, shallow file trees showing where the change lives,
and before-and-after `diff` views of either.]

### Design Questions

#### [title first question]

[the design question and why it matters]

- Option A: ...
[optional: component diagram or shallow file tree]
- Option B: ...
[optional: component diagram or shallow file tree]
- ..

Recommendation: [option] - [reason]

#### [title second design question]

...


### Resolved Design Questions

#### [title resolved question]

[option chosen] - [rationale]

[brief summary of options not chosen with rationale]


#### [title second resolved question]

...


### Deferred to PRD

- [product behavior question within the chosen direction - the behavior, interfaces, and guarantees that users, operators, and callers rely on, or how success is measured]
- ..

### Deferred to TDD

- [system or program design question within the chosen direction - how components interact and the contracts between them, or the shape of the code inside one]
- ..

### Patterns to follow

These show the patterns found in the existing codebase that the implementation will follow.

#### [title first pattern]

[summary of the pattern] - e.g. [path/to/file]

```
[succinct code examples from existing codebase demonstrating the pattern]
```

#### [title second pattern]

...
````
