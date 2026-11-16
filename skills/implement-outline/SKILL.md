---
name: implement-outline
description: Implement a structure outline one phase at a time, delegating each phase to a worker and pausing for the user's review and a commit between phases.
disable-model-invocation: true
---

# Implement a Structure Outline

You orchestrate the implementation of a structure outline from `.tasks/{task}/structure-outline.md`. You implement each phase by delegating it to a worker with `subagent_spawn`, review its result, hand the phase to the user to review, and commit before you start the next phase.

You coordinate the phases yourself. Don't write a separate plan, and don't run another create-* skill. The outline is the plan.

## Steps to follow after receiving the user's request

1. **Find the task documents**:
   - List `.tasks/{task}/`. Use the folder the user or session guidance points to. If none is given and you can't tell which task this is, ask the user.
   - Note which documents exist: `structure-outline.md` (required), `tdd.md`, `prd.md`, `design-discussion.md`, a ticket, and research. If there is no structure outline, stop and suggest the `create-structure-outline` skill.

2. **Read the structure outline FULLY** to understand the phases, their validation, and any open questions.
   - If the outline still has **Open Questions** that affect the next phase, raise them with the user before you start.
   - Find the next phase to implement (see [Resuming work](#resuming-work)).

3. **Run the phase loop** below for each phase, starting with that phase.

**Document precedence**: when documents conflict, the most recent document wins:
**structure outline > TDD > PRD > design discussion > research > ticket**

## Progress tracking

The outline records progress, so a later session can resume from it:

| Marker | Who sets it | When |
| --- | --- | --- |
| `- [x]` under **Automated Verification** | Worker | The check passes |
| `- [x]` under **Manual Verification** | You | The user confirms the check |
| `### ✅ Phase N: Title` and `- [x] Phase N: Title` in **Implementation Overview** | You | The user approves the phase |

## Phase loop

### 1. Delegate the phase to a worker

Start one worker per phase with `subagent_spawn`. Name it `phase-N`. Keep the task short: the worker reads the documents itself, so don't copy the outline into the prompt.

```text
Implement Phase [N] of the structure outline at .tasks/{task}/structure-outline.md.

Read these for context: [list only the documents that exist, e.g. .tasks/{task}/tdd.md, .tasks/{task}/prd.md]
The structure outline wins if documents conflict.

- Implement only Phase [N]. The outline gives intent, files, and signatures; write the implementation yourself.
- Follow the engineering skill and the patterns the TDD points to.
- If the codebase doesn't match what the outline assumes, stop and report the mismatch instead of improvising.
- Run every command under Phase [N]'s Automated Verification. Fix failures; don't weaken tests or checks to pass.
- Check off each passing item under Automated Verification in the outline. Change nothing else in the outline.
- Don't commit.

Reply with: files changed, what each change does, the verification results, and any deviations from the outline with your reasons.
```

Then wait for it with `subagent_wait`.

### 2. Review the worker's result

Don't take the report on trust. Read the diff (`git diff` and `git status`), and rerun the phase's automated verification yourself.

- If something is missing or fails, send the fix to the same worker with `subagent_send` and wait again.
- If the worker reports a mismatch or gets stuck, present the issue to the user and wait for guidance. Consider whether the outline needs to change because the codebase has moved on. If it does, update the outline (and an upstream document if the change affects the design or user-visible behavior) before continuing.

### 3. Report the phase to the user

```md
## Phase [N] complete: [Phase Title]

**What changed:**
- [brief summary of the changes]

**Automated verification:**
- [command] - passed

**Deviations from the outline:**
- [deviation and reason, or "None"]

**Manual verification needed:**
- [ ] [each step from the phase's Manual Verification, or "None"]

Ready for Phase [N+1] once you confirm, or tell me what needs adjusting.
```

### 4. Iterate until the user approves

Wait for the user to confirm the manual checks, report problems, or approve the phase.

- Send fixes to the same worker with `subagent_send`, review its result again (step 2), and report again.
- When the user approves, check off the confirmed Manual Verification items, mark the phase heading with ✅, and check the phase in **Implementation Overview**.

### 5. Commit the phase

- Commit the phase's changes as one commit. Use a Scoped Commits subject (`<scope>: <summary>`, imperative, no more than 72 characters, no trailing period) and pick a scope from `git log`.
- Stage only the files the phase changed. Don't stage `.tasks/` or other dotfiles unless the user asks you to.
- Don't push.
- Stop the phase's worker with `subagent_stop`. Keep its history.

### 6. Continue to the next phase

Start the next phase only when the user tells you to.

## Special cases

### Resuming work

When an outline is partly implemented:

- A phase with ✅ in its heading is done. Trust it unless something looks wrong.
- Checked boxes inside an unfinished phase show partial progress. Read the working tree and `git log` to see what is already in place, and tell the worker which parts are done.
- Start from the first phase without ✅.

### Implementing several phases in a row

When the user asks for more than one phase at once:

- Still use one worker per phase, and run the phases in order. Never run two phases in parallel.
- Review each phase (step 2) before starting the next.
- Report each phase, and pause for manual verification only after the last requested phase. Commit each phase separately once the user approves.

### Waiting for input

Unless the user explicitly says otherwise, don't commit or start a later phase until the user has reviewed and approved the current one.

## After the final phase

When every phase is approved and committed, respond with this, and nothing else:

```md
### Status

- Implementation complete: all phases in `.tasks/{task}/structure-outline.md` are marked ✅
- Ticket: [ticket ID, or omit this line when there's no ticket]

### Commits

- `[short sha]` [subject]
- ..

### Next Steps

- [Open questions or follow-ups the workers reported, or "Open a pull request for the branch."]
```

## Session guidance

Any text below these instructions is the user's guidance for this session. Use it to choose the task folder, which phases to implement, and whether to run them back to back. It changes what the session covers, not how each phase is verified and approved.
