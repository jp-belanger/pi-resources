import assert from "node:assert/strict";
import test from "node:test";
import { containsDisallowedPythonCommand } from "../extensions/uv-guard.ts";

const blocked = [
  "python script.py",
  "/usr/bin/python3.12 --version",
  "pypy3 script.py",
  "pip install requests",
  "pip3.12 install requests",
  "pipx install black",
  "poetry install",
  ".venv/bin/pytest",
  "./venv/bin/ruff check .",
  "echo ready && python script.py",
  "printf ok | pip install requests",
  "DEBUG=1 python script.py",
  "command python --version",
  "env DEBUG=1 python script.py",
  "sudo -u root /usr/bin/python3 script.py",
];

const allowed = [
  "uv run python script.py",
  "uv run pytest",
  "uvx ruff check .",
  "uv add requests",
  "uv python find",
  'echo "python script.py"',
  "rg python README.md",
  'git commit -m "fix python support"',
  "pytest",
  "ruff check .",
];

test("blocks direct Python commands outside uv", () => {
  for (const command of blocked) {
    assert.equal(
      containsDisallowedPythonCommand(command),
      true,
      `expected to block: ${command}`,
    );
  }
});

test("allows uv and non-command references to Python", () => {
  for (const command of allowed) {
    assert.equal(
      containsDisallowedPythonCommand(command),
      false,
      `expected to allow: ${command}`,
    );
  }
});

test("does not attempt to resolve generated shell commands", () => {
  assert.equal(
    containsDisallowedPythonCommand("bash -c 'python script.py'"),
    false,
  );
  assert.equal(
    containsDisallowedPythonCommand('eval "python script.py"'),
    false,
  );
});
