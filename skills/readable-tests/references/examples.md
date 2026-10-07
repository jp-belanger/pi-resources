# Expect tests in several shapes

These examples are adapted from a high-frequency trading (HFT) market-making codebase.
They use Rust and `expect-test` to test order-book updates, buy and sell orders, price
calculations, protocol messages, and validation errors.

Snippets assume application types and local test helpers; imports and unrelated setup
are omitted. They illustrate test design, not a standalone compilable application.

## 1. Scenario → intents

```rust
#[test]
fn maker_on_both_sides() {
    let mut harness = test_harness();
    harness.book_bid(99.80).book_ask(100.20);

    harness.assert(&expect![[r#"
        -- state ------------------------------
        book       99.80 | 100.20
        position    0.00
        -- intents ----------------------------
        ADD BUY   99.97 | 1 tif=Post priority=1.00
        ADD SELL 100.03 | 1 tif=Post priority=1.00
    "#]]);
}
```

The fixture establishes a reference price of 100 and the strategy parameters. The test
changes only the book. The expectation shows the relevant input state and both actions,
including ordering and execution policy, without constructing two large expected structs.
Defaults essential to understanding the prices should remain easy to find.

The harness separates production execution, rendering, and simulated application:

```rust
pub(crate) fn assert(&mut self, expected: &Expect) {
    expected.assert_eq(&self.run());
}

pub(crate) fn run(&mut self) -> String {
    let intents = self.intents();

    let mut out = String::new();
    self.print_state(&mut out);
    self.print_intents(&mut out, &intents);

    self.apply_intents(&intents);
    out
}
```

`intents()` invokes real pricing and strategy code. The printers only render observations.
`apply_intents()` simulates successful application for the next iteration: the snapshot
shows **pre-action state plus intents**, not post-action state. The harness also offers
a dry-run path that does not apply them. Keep this distinction visible when
adapting the pattern; do not simulate success implicitly in a generic assertion helper.

## 2. Input sequence → event trace AND final state

```rust
#[test]
fn trade_after_snapshot_buy() {
    let mut harness = Harness::new();
    harness.run(&[
        Input::Snapshot { seq_id: 1, bids: &[(100.0, 1.0)], asks: &[(101.0, 0.5)] },
        Input::Trade { side: Side::Buy, price: 101.0, quantity: 0.25 },
    ]);

    expect![[r#"
        | 100.00 | 101.00 | REFRESH START
        | 100.00 | 101.00 | ADD-REF BUY  100.00 | 1.00 (1.00)
        | 100.00 | 101.00 | ADD-REF SELL 101.00 | 0.50 (0.50)
        | 100.00 | 101.00 | TRD-DLY BUY  101.00 | 0.25
    "#]]
    .assert_eq(&harness.updates());

    expect![[r#"
        SELL 101.00 | 0.50
        ========== 100.500 ==========
        BUY  100.00 | 1.00
    "#]]
    .assert_eq(&harness.book());
}
```

The harness converts a small `Input` enum into real market-data inputs and feeds the
production book. It records real updates and reads the book's actual state. The trace
and final book protect different contracts: the trade is reported, but in this scenario
it does not deplete the stored book. Checking only the final state would miss lost or
extra events; checking only events would miss incorrect mutation.

This shape transfers to schedulers, incremental computations, workflows, caches, and
message consumers. Choose checkpoints and output columns for the behavior, not for an
exhaustive dump of internal fields. Complement these examples with property tests for
invariants that should hold over many possible event sequences.

## 3. Real input boundary → concise events

```rust
#[test]
fn gap_only_is_final() {
    let mut harness = Harness::new(config(u64::MAX));
    harness.snapshot(&[(100.0, 1.0)], &[(101.0, 1.0)]);

    let updates = harness.disconnect(1);

    expect![[r#"
        GapAll [final]
    "#]]
    .assert_eq(&format_updates(&updates));
}
```

The harness builds raw protocol messages and disconnect events and calls
`Processor::on_raw`. It does not fake the parser's result. A test-only observation
converts each actual update to an event description and retains its `is_final` flag:

```rust
fn format_updates(updates: &[Update]) -> String {
    let mut out = String::new();
    for update in updates {
        let marker = if update.is_final { " [final]" } else { "" };
        writeln!(&mut out, "{}{marker}", update.event).unwrap();
    }
    out
}
```

The marker matters: merely counting updates would not verify batch-final semantics.
For invalid-input tests, construct malformed external input independently; a helper
that always builds valid messages cannot exercise malformed-message handling.

## 4. Stateful checkpoints and controlled time

For a time-sensitive price calculator, keep one production instance and a controlled
`now` in the harness. Give helpers distinct meanings:

- `advance(ms)` changes time without sleeping.
- `update(...)` updates a component without flushing.
- `flush()` returns actual dirty-asset emissions, formatted with price, volatility,
  and remaining TTL.
- `md(...)` advances time by one millisecond, updates, and flushes.

A warmup scenario feeds three observations into the same instance and checks each output:

```rust
#[test]
fn volatility_requires_three_observations() {
    let mut harness = PriceHarness::new();

    expect!["price=3501 volatility=None"].assert_eq(&harness.observe(3501.0));
    expect!["price=3511 volatility=None"].assert_eq(&harness.observe(3511.0));
    expect!["price=3506 volatility=Some"].assert_eq(&harness.observe(3506.0));
}
```

Here the renderer reports whether volatility is available, because warmup is the contract
being tested. Test its numerical value separately. Additional scenarios can update several
components before flushing to check batching, or advance time to check staleness.

The transferable idea is **make history visible**. Use several inline expectations in
one test when each step explains the next. Keep independent cases in separate tests.
A relative TTL can be more readable than an absolute timestamp, but only if the test
still checks the timing relationship it claims to protect.

## 5. Small parsed value → Debug snapshot

```rust
#[test]
fn peek_trade() {
    let msg = r#"{"stream":"ethusdt@trade","data":{"e":"trade","E":1762988627129,"s":"ETHUSDT","t":6776123308,"p":"3414.48","q":"0.007","X":"MARKET","m":true}}"#;

    let details = peek_msg(msg.as_bytes()).unwrap();
    expect![[r#"
        WsPeek {
            symbol: "ETHUSDT",
            topic: "trade",
            sequence_id: 6776123308,
        }
    "#]]
    .assert_debug_eq(&details);
}
```

Here `Debug` is already a clear specification. A custom formatting layer would add
work without helping the reader. The same style appears in exchange REST/WebSocket
model parsing and decimal parsing. Use a narrow representation when Debug instead
exposes a large incidental object graph, unstable addresses, or unordered internals.

## 6. Actual wire output or diagnostics → text expectation

Capture the actual bytes written by an HTTP builder. A small helper can make CRLF
visible with `.replace("\r\n", "<CR>\n")`:

```rust
#[test]
fn basic_get() {
    let req = build(|http| http.get("/api/orders").finish());

    expect![[r#"
        GET /api/orders HTTP/1.1<CR>
        Host: byzantine.sh<CR>
        <CR>
    "#]]
    .assert_eq(&req);
}
```

The helper does not rebuild the request from parsed fields or trim away whitespace.
Use the same approach for content lengths, headers, encoded bodies, and serialized
records. If a textual rendering could conflate distinct byte sequences relevant to the
protocol, assert raw bytes too.

For validation, expect the precise diagnostic:

```rust
#[test]
fn asset_long_rate_exceeds_upper_bound() {
    assert_err(
        Harness::new()
            .with_asset(|asset| asset.long_rate = 3.0)
            .build(),
        &expect!["out of bounds; param=long_rate; value=3; bounds=-2..=2"],
    );
}
```

Its helper calls `unwrap_err()` before comparing the error's `Display` output, so an
unexpected success fails. If the error variant is independently important to callers,
assert the variant as well as the message. Success cases can simply unwrap the result.

## Applying the pattern

- Reuse the repository's snapshot tool. With `expect-test`, use `expect![...]` and
  `assert_eq` for text, or `assert_debug_eq` for useful Debug output. A project's existing
  inline snapshot equivalent is fine; do not add a second library just for spelling.
- Use exhaustive matches when rendering closed action/event enums. A new variant should
  force a decision about its representation, not disappear through a wildcard arm.
- Keep decimal precision sufficient for the invariant. Fixed formatting from a financial
  example is not a universal numerical assertion strategy.
- Use direct assertions for a scalar or empty collection when they say everything needed.
- Follow the installed tool's update workflow. For `expect-test`, `UPDATE_EXPECT=1` can
  update inline expectations during a targeted test run. Review the diff, then rerun with
  that variable unset. Do not run a repository-wide update to accept unrelated failures.

The shared pattern is **small inputs, real execution, readable complete observations**.
Neither an elaborate harness nor a custom text format is mandatory.
