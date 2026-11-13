# Design Discussion Format

## Template

````md
# [Design Discussion Title]

### Summary of change request

[summary of what the user wants to build based on their request and the ticket]

### Current State

- [what users, operators, or callers see or experience today — current behavior, gaps, pain points — no file paths or function names]
- ..
- ..

### Desired End State

- [what will be true when this work is done]
- [user story, problems that will be solved, new things a user can do]
- ..

### What we're not doing

- [things that are out of scope]
- ..

### Proposed End State Architecture

[concise outline of the proposed end state architecture with description, diagrams, pseudocode, etc according to show-me]

### Design Questions

#### [title first question]

[the design question]

- Option A: ...
[optional: short code snippet, mermaid diagram, pseudocode, etc]
- Option B: ...
[optional: short code snippet, mermaid diagram, pseudocode, etc]
- ..

Recommendation: [....]

#### [title second design question]

...


### Resolved Design Questions

#### [title resolved question]

[option chosen] - [rationale] - [pattern to follow or pseudocode, mermaid diagram, etc]

[brief summary of options not chosen with rationale]


#### [title second resolved question]

...


### Patterns to follow

These show the patterns found in the existing codebase that will be followed to implement the proposed end state architecture.

#### [title First pattern from research]

[summary of the pattern] - e.g. [path/to/file]

```
[succinct code examples from existing codebase demonstrating the pattern]
```

```
[succinct code examples from proposed end state architecture demonstrating the pattern]
```

#### [title Second pattern from the research]

...
````
