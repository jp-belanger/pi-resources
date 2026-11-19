---
name: create-design-discussion
description: Write a design discussion that frames a change and settles its direction-setting questions with the user one at a time, deferring product behavior to the PRD and system and program design to the TDD.
disable-model-invocation: true
---

# Create a Design Discussion

You are creating a design discussion: the document where you and the user agree on what a change should achieve and settle the decisions that set its direction, before anyone writes a spec or a plan. You research the codebase, put the open design questions on the table, then work through them with the user one at a time.

A design discussion decides **direction**: which approach to take, what to reuse or build, where the change lives, and what it must not break. It does not replace the PRD or the TDD, which make their own decisions in more detail. The PRD settles WHAT we're building and WHY: the behavior, interfaces, and guarantees that users, operators, and callers rely on, and how success is measured. The TDD settles HOW: the system design - how services, endpoints, schemas, queues, stores, and external systems interact - and the program design - the shape of the code inside each component. The design discussion makes only the coarse decisions that come before both. When you spot a question at their level, record it for them and move on. The one exception is when the user skips the PRD or TDD: then you settle those questions here at the end (step 7).

You run it as a guided discussion in two ordered steps:

1. **Framing** - what exists today, what should be true when the work is done, and what's out of scope.
2. **Design questions** - one decision at a time, building the proposed architecture as decisions land.

**You recommend; the user decides.** The draft lists every design question with your recommendation, but the **Proposed Architecture** holds only today's shape until the user resolves questions. Never write the target design ahead of the user's decisions - a finished plan with questions attached is not a discussion.

## Which questions belong here

A question belongs in the design discussion when its answer sets the direction for the work that follows. Each level owns different kinds of questions:

| Level | Kinds of questions |
|---|---|
| Design discussion | Which approach to take, whether to extend something that exists or build something new, which components are involved and which owns the change, what's in or out of scope, what must keep working |
| Deferred to PRD | Product behavior: the behavior, interfaces, and guarantees that users, operators, and callers rely on - workflows, states, and what they meet in a CLI session, API call, config file, or log output - and how success is measured |
| Deferred to TDD | System design: how services, endpoints, schemas, queues, stores, and external systems interact, and the contracts at those boundaries. Program design: the shape of the code inside each component |

When a question's level isn't obvious, test it:

- **Cost of reversal.** If changing the answer later would mean throwing away a PRD or TDD, it belongs here. If it would only mean rewriting a section of one, defer it.
- **Option detail.** If each option fits in one sentence or a diagram of which components are involved, it belongs here. If you need concrete examples of what users or callers meet - a CLI session, API call, config file, or log output - to tell the options apart, it's a PRD question. If you need endpoint or message shapes, data schemas, type signatures, or call trees, it's a TDD question.
- **Shapes later work.** If the answer changes which questions the PRD or TDD will ask, it belongs here. If it's one question among many inside them, defer it.

Record each question that fails these tests under **Deferred to PRD** or **Deferred to TDD**, one line each, and don't discuss it. Deferring keeps the question visible to whoever picks up the work next without answering it here.

A design discussion usually has a handful of questions. If you have more than about six, some of them belong in the deferred lists.

## How the conversation works

**Exactly one question per message.** End every message with a single question - never a second question, a stacked follow-up, or an "and also...". Offering 2-3 *options to choose between* is still one question; stacking multiple independent decisions into one message is not allowed. Present the decision with its options, tradeoffs, and your recommendation, then stop and wait. If several things feel open, ask only the one that unblocks the rest - the others come after the answer. Never ask for a vague "any feedback?".

**Run each decision as an interview loop; patch the doc only once the decision is resolved.** Ask your one question, then work back and forth until it's settled. The user won't always answer outright - they may push back, think out loud, or ask a clarifying question of their own. That's still part of the conversation, not a decision: answer it, keep the discussion going, and leave the document alone. A decision is resolved when the user has clearly chosen - not when they've mentioned an option or asked about it.

**Stay at the level of direction.** If the discussion drifts into product behavior, system design, or program design, note the question under **Deferred to PRD** or **Deferred to TDD**, say so in one line, and steer back to the decision at hand.

**Don't accept corrections blindly.** When the user says the code works differently than you described, read the files they mention, or delegate a focused investigation, and continue only once you've verified it. When the user leans toward an option with a consequence they may not have seen, say so once, concretely, then accept their call.

**When you flush a resolved decision, re-work the document rather than appending to it.** Rewrite the **Proposed Architecture** so it absorbs the decision as one coherent design. Touch every other affected section in the same pass: rule things out in **What we're not doing**, add design questions the decision raised, remove questions it made moot, and defer follow-ups it opened for the PRD or TDD. Rewriting entire sections as you go is expected, not exceptional.

**Show, don't tell - at the component level.** Follow the [show-me](../show-me/SKILL.md) guidance, but pick views that match a direction-setting decision: Mermaid diagrams of which components are involved and how they connect, shallow file trees showing where the change lives, and before-and-after `diff` views of either. Leave concrete examples of product behavior to the PRD, and contracts, schemas, signatures, call trees, and pseudocode to the TDD. Place each visual beside the short text it supports, and use the smallest set of views that makes the decision clear.

**Get more context when you need it.** When a decision depends on how the codebase actually works, investigate before presenting options: read the relevant code, or delegate focused investigations to subagents (locate files, analyze how a system works, find patterns to model after) and ask for file:line references. Don't ask the user what the project can answer.

## 1. Understand the context

The user's description of the task, in the session guidance below, is the change request. It is often the only input.

- Read every file the description mentions **fully**. If it points to an existing task folder, list `.tasks/{task}/` and read its documents fully too. Do not delegate to subagents before reading these yourself.
- Research the codebase the change touches: how it works today, where the change would land, and the patterns to model after. Delegate focused investigations to subagents when several areas are involved. Every claim in the draft about current behavior must rest on code you've read.
- If the description is thin, don't invent requirements. Turn the gaps into design questions, or settle them in the framing step.

## 2. Write the draft

Write the doc to `.tasks/{task}/design-discussion.md` at the project root. Reuse the task folder if one exists for this work. Otherwise create it: `{task}` is a short lowercase kebab-case slug named from the description.

Use the template in [DESIGN-DISCUSSION-FORMAT.md](./DESIGN-DISCUSSION-FORMAT.md). Write:

- **Summary of change request**, **Current State**, **Desired End State**, and **What we're not doing** as a first draft.
- **Proposed Architecture** showing only today's shape of the part of the system the change touches.
- **Design Questions**: each direction-setting decision with its options, tradeoffs, and your recommendation, ordered so earlier answers unblock later ones.
- **Resolved Design Questions** stays empty. Never resolve a question yourself, even when the answer seems obvious - recommend it instead.
- **Deferred to PRD** and **Deferred to TDD**: the lower-level questions you spotted, one line each. Omit a header when it has nothing under it.
- **Patterns to follow**: existing codebase patterns the implementation should follow, including how the components being changed are tested, with file locations and short snippets.

Before you respond, check every design question against [Which questions belong here](#which-questions-belong-here) and move any that fail to the deferred lists.

Then open the framing step. List the design questions and patterns by title only so the user sees the agenda and can flag a wrong pattern early. Quote the **Current State**, **Desired End State**, and **What we're not doing** you drafted, and ask whether your understanding is right:

> I've drafted the design discussion at `.tasks/{task}/design-discussion.md`. There are {N} open design questions, which we'll take one at a time:
>
> 1. {question title}
> 2. {question title}
> 3. ..
>
> The implementation would follow these existing patterns: {pattern title}, {pattern title}, ..
>
> First, the framing. Have I understood where things stand today and where we want to end up?
>
> > **Current State**
> > - ...
> >
> > **Desired End State**
> > - ...
> >
> > **What we're not doing**
> > - ...

## 3. Settle the framing

Iterate on the framing until the user is happy. Verify any correction to **Current State** against the code before accepting it, then re-work the framing sections. If the user flagged a pattern as wrong or out of date, fix or remove it in **Patterns to follow**. If the framing changed, revise the design questions it affects before asking the first one.

## 4. Resolve the design questions

Take the design questions in order, one per message. For each one:

1. Present the decision: what's being decided and why it matters, each option with its tradeoff and a sketch when the options differ in shape, and your recommendation with its reason.
2. Work back and forth until the user has clearly decided.
3. Move the question to **Resolved Design Questions** as a short record: the choice, why, and the options not chosen with why. Leave the product behavior it implies to the PRD and the design it implies to the TDD.
4. Re-work the **Proposed Architecture** and every other affected section.

Open the next message with one line naming the decision you recorded and the sections you updated, then ask the next question.

The user may answer out of order or settle several questions at once. Accept a clear answer whenever it comes, flush it, and continue with the next open question. If the user says they edited the document or left notes in it, re-read it and discuss their notes before treating them as decisions.

## 5. Review gate

When no design questions remain open, hand the document back for review. The user has seen it built piece by piece, not read it as a whole. Say something like:

> All design questions are resolved. Can you read the **Proposed Architecture** top to bottom and confirm it hangs together, and check that **Patterns to follow** lists the patterns you want the implementation to follow?

Wait for the user's approval and incorporate any fixes.

## 6. Choose the next step

When the user approves, give the path to the design discussion, list the decisions one line each, and say how many questions are deferred to the PRD and to the TDD. Then recommend the next step that fits the work and ask which one they want:

- `create-prd` when questions are deferred to the PRD or product behavior still needs a spec.
- `create-tdd` when only system or program design remains.
- `create-structure-outline` when nothing is deferred.

The deferred lists hand the open questions to the PRD or TDD. If the user wants to skip those and go straight to the structure outline while questions are still deferred, offer to settle them here first, so the outline doesn't start from open questions.

## 7. Settle deferred questions (when skipping the PRD or TDD)

When the user takes that offer, the design discussion becomes the whole design, so the level rules no longer apply. Take the deferred questions one per message with the same interview loop as step 4, at whatever level each one needs: show product behavior as concrete examples, and system or program design with the signatures, schemas, call trees, or pseudocode the [show-me](../show-me/SKILL.md) guidance offers. Record each answer in **Resolved Design Questions**, remove it from its deferred list, and fold it into the **Proposed Architecture**. When the lists are empty, run the review gate (step 5) again on what changed, then wrap up.

## 8. Wrap up

Once the user has chosen the next step and nothing is left to settle here, give the path to the design discussion and name the skill to run next. Do not implement.

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

### Document precedence

When documents conflict, the most recent document wins:
**design discussion > task description**

Decisions made during the design discussion supersede the original task description.

## Session guidance

Any text below these instructions is the user's description of the task and guidance for this session. Use it as the change request: it drives the summary, the context you read, the task name, and which questions to raise. Draft anything it already settles and confirm it rather than re-asking. Put what it rules out under **What we're not doing**. It changes what the session covers, not how it runs.
