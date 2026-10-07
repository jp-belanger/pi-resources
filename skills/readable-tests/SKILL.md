---
name: readable-tests
description: >-
  Write readable expect tests, using inline expectations for results,
  event traces, state, wire output, and diagnostics. Use when writing, changing,
  or reviewing tests, or designing test harnesses and snapshot representations.
  Prefer expect tests when they make behavior easier to understand; retain direct
  assertions and property tests where clearer.
---

# Readable tests

Favor the test reader. Prefer **expect tests**: execute real behavior and compare its
output with a readable inline expectation. A test should explain a scenario, not make
readers reconstruct it from mocks, plumbing, or scattered field assertions.

Inspect nearby tests and test configuration. Identify the behavior being protected and
an actual mistake the test should catch. Then:

1. Set up a small scenario in domain terms.
2. Execute real production behavior through the interface that owns it.
3. Observe the relevant result, actions, state, or failure.
4. Compare it with an explicit expectation next to the scenario.

Read [the examples](references/examples.md) before designing a harness or representation.
They use Rust to demonstrate the concepts; the technique applies across languages.

## Name tests hierarchically

Use `<feature>_<scenario>_<outcome>` so related tests are easy to scan and filter.
Group them with consistent prefixes or test modules; do not repeat context already
provided by the module. For example: `cache_fresh_hit`,
`cache_expired_miss`, and `cache_absent_miss`.

## Choose the observation

- Capture what explains the behavior: a parsed value, actual serialized output, a
  diagnostic, ordered actions, or state at meaningful checkpoints. Check both events
  and final state when they protect different contracts.
- Keep expectations inline when practical. Use existing structured or debug output
  when already readable; add a compact renderer only when it tells the story better.
- Assert intentional silence explicitly. Use direct assertions for simple values,
  predicates, and absence; add property tests for invariants over many inputs.

## Keep the harness and rendering honest

- Start with a direct call. Add a small, local harness when repeated setup or a sequence
  becomes clearer through domain operations. Give fixtures valid defaults while keeping
  inputs essential to understanding the result visible.
- Helpers may construct inputs, control time, collect events, and format observations.
  They must not duplicate production decisions.
- **Avoid mocking.** If a test needs mocks, first look for a boundary or interface problem.
  Separate logic from I/O so the harness can exercise the real implementation. Surface
  design issues that cannot be addressed within the task’s scope.
- Render actual observations without silently dropping unexpected actions or sorting
  meaningful sequences. Include the fields, precision, and whitespace the test protects;
  an expectation proves nothing about omitted distinctions.
- Control nondeterminism at its source where practical. Normalize only irrelevant
  variability; preserve identity and timing relationships. Use safe, synthetic data.
- For stateful scenarios, show explicit steps and checkpoints. Make it clear whether a
  helper observes, executes, drains, or simulates success, and what state the next step
  inherits. Advance controlled time instead of sleeping.
- Distinguish emitted intents from completed effects. A harness that applies commands
  as immediately successful does not establish network, durability, or recovery behavior.

## Review expectations

- Derive expected behavior from the requirement or an independently reasoned example,
  not the implementation under test. For a regression, demonstrate that the test fails
  against broken behavior when practical.
- Update only the intended expectations, review every changed line, then rerun with
  updating disabled. Generated output is a proposal to review, not proof of correctness.
- Run the relevant tests and checks, and report verification gaps honestly.

Before finishing, ask: **Can a reader explain the input, expected outcome, and regression
this test detects without stepping through the implementation?**
