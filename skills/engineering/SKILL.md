---
name: engineering
description: >-
  Apply when designing, writing, reviewing, or changing code. Understand the domain,
  model its rules, design coherent interfaces, and keep complexity proportional to
  the problem. Verify behavior and measure performance rather than assuming them.
---

# Engineering

Understand broadly; change narrowly. Favor readers and callers over implementation convenience.

## Understand the problem

- Start from the user's goal; distinguish the need from the proposed solution.
- Trace the relevant operation end to end. Model the domain, not the accidents of its implementation.
- Use consistent domain terms. Make clear what each value measures and what one record represents.
- Make entity identity, units, and meaningful ordering explicit.

## Model the rules

- Prefer a representation that makes illegal states impossible to another conditional.
- Encode invariants in types and checks, not repeated carefulness. Handle alternatives exhaustively.
- Give each rule and mutable state a clear owner. Keep an authoritative source for each fact; derive other views where practical.
- Make state transitions and effects explicit. Separate computation from effects where useful.
- Validate at trust boundaries; preserve invariants inside. Recheck when the state or trust changes.

## Design for callers and readers

- Design interfaces from concrete uses. Give each interface a coherent responsibility.
- Hide machinery, not domain meaning, consequential costs, or failure modes.
- Compose small interfaces through explicit contracts, not knowledge of each other's internals.
- Unify shared concepts, not merely similar-looking code. Preserve meaningful differences.

## Keep the system small

- Solve the present problem. Add generality when concrete uses justify it.
- Prefer a few composable mechanisms to accumulating special cases and configuration options.
- Keep the common case simple; make advanced capabilities pay their own complexity cost.
- Prefer straightforward code to clever machinery, including elaborate type machinery.

## Change the right thing

- Trace symptoms to their cause. Fix the owning rule or representation, not every place it leaks.
- Handle legitimate failures explicitly. Do not hide broken assumptions behind defaults or retries.
- Choose the smallest coherent change, not the smallest diff. Avoid unrelated redesign.

## Make performance evidence-based

- Define the relevant metric and representative workload before optimizing.
- Measure before and after. Check that the measurement reflects the work and conditions that matter.
- Prefer doing less work to doing it faster. Keep complexity only when its measured benefit justifies it.

## Verify the result

- Test observable behavior and domain invariants, including meaningful failure cases.
- Make failures reproducible; keep reproductions as regression tests.
- Use expect or snapshot tests when they make behavior easier to inspect.
- Match evidence to the claim. Check the real behavior at the relevant boundary; compilation and mocks alone do not prove it.
- Report what was verified and what remains uncertain.
