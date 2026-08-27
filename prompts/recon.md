---
name: recon
description: Build relevant codebase context for the work ahead.
argument-hint: "[focus areas or planned work]"
---

Explore the codebase to build a concise working model for the current session.

User focus or planned work: $ARGUMENTS

Prioritize relevant:

- Key abstractions and their responsibilities, plus components, boundaries, interfaces, and stores.
- Main control and data flows.
- Invariants, assumptions, and side effects.
- Tests, configuration, and integration points.

Cite key files and symbols. Distinguish confirmed behavior from inference, and note important unknowns. Avoid exhaustive file summaries and do not modify the codebase.

Return a compact reconnaissance brief with the system overview, key abstractions, execution paths, invariants, risks, and high-value files.
