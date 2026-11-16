---
name: engineering
description: >-
  Use this skill whenever the user wants code designed, written, changed, or
  reviewed: building a feature, fixing a bug, refactoring, writing tests, making
  something faster, or changing a data model, schema, API, file format, or
  migration. Apply it even when the request looks routine or doesn't mention
  design, testing, or architecture. Skip it for work that leaves code behavior
  alone, such as explaining code, running commands, git housekeeping, or editing
  prose.
---

# Engineering

Understand broadly; change narrowly. Favor readers and callers over implementation convenience.

## Understand the problem

- Start from the user's goal; distinguish the need from the proposed solution.
- Trace the relevant operation end to end. Model the domain, not the accidents of its implementation.
- Use consistent domain terms. Make clear what each value measures and what one record represents.
- Make entity identity, units, and meaningful ordering explicit.

## Model the rules

- Make illegal states unrepresentable. Fix the representation instead of guarding a weak one with conditionals.
- Model alternatives as sum types (tagged unions, enums with data), not nullable fields or flag combinations. Make absence explicit and match exhaustively.
- Give domain concepts their own types instead of strings or primitives. When the domain gains a concept, give it a first-class type rather than a flagged special case of an old one.
- Encode invariants in types and checks, not repeated carefulness.
- Give each rule and mutable state a clear owner. Keep an authoritative source for each fact; derive other views where practical.
- Make state transitions and effects explicit. Separate computation from effects where useful.
- Keep state in inspectable data, not in control flow. Avoid shared mutation by removing either the sharing or the mutation.
- Route nondeterminism (time, randomness, I/O, concurrency) through boundaries that callers and tests can control, so a rare race becomes a repeatable test. Add nondeterminism only as a deliberate, measured trade.
- Validate at trust boundaries; preserve invariants inside. Recheck when the state or trust changes.

## Design for callers and readers

- Design interfaces from concrete uses. Give each interface a coherent responsibility.
- Hide machinery, not domain meaning, consequential costs, or failure modes.
- Prefer explicit behavior to implicit magic. When a choice is ambiguous, fail rather than guess.
- Prefer abstractions whose behavior a reader can predict, with an escape hatch to precise control. Design the seam between the two carefully, because that is where bugs live.
- Make misuse hard to write: shape interfaces so harmful usage patterns don't type-check or aren't expressible. Avoid global mutable namespaces and singletons; they block local reasoning and composition.
- Constrain a surface (declarative, data-not-code) when the restriction lets the system analyze, validate, or optimize for callers.
- Compose small interfaces through explicit contracts, not knowledge of each other's internals.
- Unify shared concepts, not merely similar-looking code. Preserve meaningful differences.

## Keep the system small

- Solve the present problem. Add generality when concrete uses justify it.
- Look for what not to solve. Narrowing a guarantee (ordering per source rather than global; atomicity per table) often keeps the value and removes most of the cost. Look for the one unnecessary constraint that forces complexity everywhere else.
- Prefer a few composable mechanisms to accumulating special cases and configuration options.
- Don't add options, flags, or modes just because they're cheap to generate. Every knob multiplies the configuration space.
- Keep the common case simple; make advanced capabilities pay their own complexity cost.
- Use standard and platform solutions by default.
- Prefer straightforward code to clever machinery, including elaborate type machinery.
- Prefer mechanisms whose failures you can explain to stronger guarantees that fail opaquely.
- If a component couldn't be rewritten correctly in a short time, or the change needs paragraphs to justify, simplify the design before shipping it.

## Change the right thing

- Trace symptoms to their cause. Fix the owning rule or representation, not every place it leaks.
- When you fix a bug, ask what made this class of bug possible. Fix that if it's in scope; otherwise report it.
- Don't wrap a broken foundation in another layer. Fix the lower layer or report it.
- Handle legitimate failures explicitly. Do not hide broken assumptions behind defaults or retries.
- Do not weaken tests, assertions, types, or warnings to make a change pass, and don't game them: no special-casing code to satisfy a test, hard-coding expected outputs, or silencing warnings. Treat warnings in touched code as errors. Change a check only when the check is wrong, and say why.
- Choose the smallest coherent change, not the smallest diff. Avoid unrelated redesign.
- Finish migrations. When you introduce a new way, move every caller in scope and delete the old path, or list what remains. Don't leave two ways.

## Evolve contracts safely

- Treat persisted data, wire formats, and public APIs as contracts with consumers. Prefer additive changes.
- Give hard-to-reverse decisions (formats, protocols, identifiers) extra care before the first release.
- Version persisted and wire formats from day one. Embed a version or digest so incompatible readers fail loudly instead of misreading.
- Derive both sides of a protocol from one shared type definition so they can't drift.
- Ship format or schema changes separately from risky logic changes.
- Keep raw inputs and when they were received, so past states can be reconstructed.
- When replacing existing code, treat it as accumulated knowledge. Preserve its behavior unless a change is deliberate. Run old and new on the same inputs and diff the outputs; mismatches often expose bugs in the old code.

## Make performance evidence-based

- Define the relevant metric and representative workload before optimizing.
- Measure before and after. Check that the measurement reflects the work and conditions that matter.
- Prefer doing less work to doing it faster. Keep complexity only when its measured benefit justifies it.
- Prefer predictable performance to dependence on an opaque optimizer that collapses after a small edit.
- In hot code, write efficiently by default. Elsewhere, write clear code and leave it alone.

## Verify the result

- Test observable behavior and domain invariants, including meaningful failure cases.
- Test through the component's interface. Do not assert on internals (private state, call order, mocked collaborators); a refactor that preserves behavior must not break a test.
- Match technique to the input space: examples for clarity, property-based tests for invariants, exhaustive tests for small domains. Give round-trip transformations explicit laws.
- Coverage is not exploration. The state space lives in data and event ordering.
- Types do little against numeric bugs. Check numeric results against real data or exact properties.
- Make runs and failures reproducible: pin dependencies, record seeds and inputs, and keep reproductions as regression tests.
- Use expect or snapshot tests when they make behavior easier to inspect. Curate their output so the diff reads as a trace of the behavior change.
- Match evidence to the claim. Check the real behavior at the relevant boundary; compilation and mocks alone do not prove it.
- Passing tests don't preserve clarity. Reread the diff for readability and architecture.
- Report what was verified and what remains uncertain.

## Keep the change reviewable

- Verification is the bottleneck. Optimize for how easily someone can review the change, not how fast it was written.
- Write code simple enough that a reviewer could rewrite it.
- When generating both a specification and its implementation, put the specification (types, properties, invariants) in front of the human first, so it can be judged independently.
- Present changes in the order a reviewer needs them; split large changes into separately reviewable steps.
- When documenting code is hard, treat that as a sign of a conceptual bug.
- Replace step-by-step manual instructions with scripts or code that can be checked and rerun.
