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
- Encode invariants in types and checks, not repeated carefulness.
- Give each rule and mutable state a clear owner. Keep an authoritative source for each fact; derive other views where practical.
- Make state transitions and effects explicit. Separate computation from effects where useful.
- Route nondeterminism (time, randomness, I/O, concurrency) through boundaries that callers and tests can control.
- Validate at trust boundaries; preserve invariants inside. Recheck when the state or trust changes.

## Design for callers and readers

- Design interfaces from concrete uses. Give each interface a coherent responsibility.
- Hide machinery, not domain meaning, consequential costs, or failure modes.
- Prefer explicit behavior to implicit magic. When a choice is ambiguous, fail rather than guess.
- Compose small interfaces through explicit contracts, not knowledge of each other's internals.
- Unify shared concepts, not merely similar-looking code. Preserve meaningful differences.

## Keep the system small

- Solve the present problem. Add generality when concrete uses justify it.
- Prefer a few composable mechanisms to accumulating special cases and configuration options.
- Keep the common case simple; make advanced capabilities pay their own complexity cost.
- Prefer straightforward code to clever machinery, including elaborate type machinery.
- Prefer mechanisms whose failures you can explain to stronger guarantees that fail opaquely.

## Change the right thing

- Trace symptoms to their cause. Fix the owning rule or representation, not every place it leaks.
- Handle legitimate failures explicitly. Do not hide broken assumptions behind defaults or retries.
- Do not weaken tests, assertions, types, or warnings to make a change pass. Change a check only when the check is wrong, and say why.
- Choose the smallest coherent change, not the smallest diff. Avoid unrelated redesign.

## Evolve contracts safely

- Treat persisted data, wire formats, and public APIs as contracts with consumers. Prefer additive changes.
- Give hard-to-reverse decisions (formats, protocols, identifiers) extra care before the first release.

## Make performance evidence-based

- Define the relevant metric and representative workload before optimizing.
- Measure before and after. Check that the measurement reflects the work and conditions that matter.
- Prefer doing less work to doing it faster. Keep complexity only when its measured benefit justifies it.

## Verify the result

- Test observable behavior and domain invariants, including meaningful failure cases.
- Test through the component's interface. Do not assert on internals (private state, call order, mocked collaborators); a refactor that preserves behavior must not break a test.
- Match technique to the input space: examples for clarity, property-based tests for invariants, exhaustive tests for small domains. Give round-trip transformations explicit laws.
- Make runs and failures reproducible: pin dependencies, record seeds and inputs, and keep reproductions as regression tests.
- Use expect or snapshot tests when they make behavior easier to inspect.
- Match evidence to the claim. Check the real behavior at the relevant boundary; compilation and mocks alone do not prove it.
- Report what was verified and what remains uncertain.
