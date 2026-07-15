---
description: Create a high-quality source git commit
argument-hint: "[files, globs, or guidance]"
---

Create a git commit for the current changes using a concise Scoped Commits-style subject.

Additional guidance, files, or globs provided by the user: $ARGUMENTS

## Format

`<scope>: <summary>`

- `scope` REQUIRED. Short noun for the affected area (e.g., `api`, `parser`, `ui`).
- `summary` REQUIRED. Short, imperative, <= 72 chars, no trailing period.

## Notes

- Body is OPTIONAL. If needed, add a blank line after the subject and write concise paragraphs. It should fill in the details and include any supplemental information a reader needs to understand the changelist holistically.
- Only commit; do NOT push.
- If it is unclear whether a file should be included, ask the user which files to commit.
- Treat user-provided arguments as additional commit guidance. Common patterns:
  - Freeform instructions should influence scope, summary, and body.
  - File paths or globs should limit which files to commit. If files are specified, only stage/commit those unless the user explicitly asks otherwise.
  - If arguments combine files and instructions, honor both.

## Steps

1. Infer from the arguments whether the user provided specific file paths/globs and/or additional instructions.
2. Review `git status` and `git diff` to understand the current changes (limit to argument-specified files if provided).
3. Optionally run `git log -n 50 --pretty=format:%s` to see commonly used scopes.
4. If there are ambiguous extra files, ask the user for clarification before committing.
5. Stage only the intended files (all changes if no files were specified).
6. Run `git commit -m "<subject>"` (and `-m "<body>"` if needed).
