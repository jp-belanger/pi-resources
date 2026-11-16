# Structure Outline Format

## Template

````md
# [Structure Outline Title]

[2-3 sentence summary of the plan. Link the upstream documents it builds on, e.g. `tdd.md` and `prd.md` in this folder.]

### Desired End State

- [what will be true when this is done]
- ..

### Implementation Overview

- [ ] Phase 1: [Phase Title]
- [ ] Phase 2: [Phase Title]
- [ ] ..

---

### Phase 1: [Phase Title]

[What this phase builds, and what someone can do or observe once it lands]

#### Change Outline

[Present this phase in the order that makes it easiest to follow. Show files first when ownership gives the needed context, or a data structure, SQL table, or API contract first when it explains the rest. Every view and subheading is optional: choose and order views to fit the change. Write it the way one person would explain the change to another. Use `diff` for a focused change to an existing shape. Use a language-specific or `text` block for the complete target shape when it is new, high-level, or clearer without diff notation.]

{...short description...}

```diff
 path/to/shared/root/
 ├── existing-area/
 │   ├── existing-file.ts
+│   │   ~ [high-level behavior or code shape that changes]
+│   ├── new-module.ts          # owns the new behavior
+│   └── new-module.test.ts     # covers the new behavior
 └── other-area/
-    ├── removed-file.ts
+    └── changed-file.ts        ~ short ownership or behavior note
```

[Keep a file tree high-level and easy to scan. Use the tree glyphs `├──`, `└──`, and `│`. Start added lines with `+`, removed lines with `-`, and unchanged context lines with a space. A changed line also starts with `+` and carries a `~` note. Show key methods, fields, or data flow beneath a file only when they clarify the change.]

{...short description...}

```ts
type RecordStatus = 'draft' | 'active' | 'archived'

interface RecordSummary {
  id: string
  status: RecordStatus
}
```

{...short description...}

```diff
 records
   id                 uuid primary key
+  status             text not null        # new lifecycle state
+  organization_id    uuid not null        ~ included in the lookup index
-  legacy_flag        boolean
```

{...short description...}

```diff
 PATCH /records/:id
 request
   id: string
+  status: RecordStatus
 response
   record: Record
+    status: RecordStatus
```

#### Validation

##### Automated Verification

- [ ] [runnable command from this repo, e.g. `just check`]
- [ ] ..

##### Manual Verification

[Optional. Only steps that need human judgment.]

- [ ] [manual test step]
- [ ] ..

---

### Phase 2: [Phase Title]

..

---

### Open Questions

[Optional. Questions about the phasing that need the user's input, each with a recommendation. Omit the header if there are none.]

- [question] - Recommendation: [...]
- ..
````
