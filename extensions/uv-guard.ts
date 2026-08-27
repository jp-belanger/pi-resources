import {
  type ExtensionAPI,
  isToolCallEventType,
} from "@earendil-works/pi-coding-agent";

const PYTHON_COMMAND_CANDIDATE =
  /python|pypy|pip|poetry|(?:^|\/)\.?venv\/bin\//;
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
const NO_OPTIONS_WITH_VALUES = new Set<string>();
const DENIAL_REASON =
  "Python commands must be run through uv. Use `uv run` instead. Do not retry this command outside uv.";

const ENV_OPTIONS_WITH_VALUES = new Set([
  "-C",
  "--chdir",
  "-S",
  "--split-string",
  "-u",
  "--unset",
]);
const SUDO_OPTIONS_WITH_VALUES = new Set([
  "-C",
  "--close-from",
  "-D",
  "--chdir",
  "-g",
  "--group",
  "-h",
  "--host",
  "-p",
  "--prompt",
  "-R",
  "--chroot",
  "-r",
  "--role",
  "-T",
  "--command-timeout",
  "-t",
  "--type",
  "-u",
  "--user",
]);

function commandSegments(command: string): string[][] {
  const segments: string[][] = [];
  let segment: string[] = [];
  let word = "";
  let quote: "'" | '"' | undefined;
  let escaped = false;

  const finishWord = () => {
    if (word.length === 0) return;
    segment.push(word);
    word = "";
  };

  const finishSegment = () => {
    finishWord();
    if (segment.length > 0) segments.push(segment);
    segment = [];
  };

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];

    if (escaped) {
      word += char;
      escaped = false;
      continue;
    }

    if (char === "\\" && quote !== "'") {
      escaped = true;
      continue;
    }

    if (quote) {
      if (char === quote) quote = undefined;
      else word += char;
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }

    if (char === "#" && word.length === 0) {
      while (index + 1 < command.length && command[index + 1] !== "\n") {
        index += 1;
      }
      continue;
    }

    if (char === "\n" || char === ";" || char === "|" || char === "&") {
      finishSegment();
      continue;
    }

    if (/\s/.test(char)) {
      finishWord();
      continue;
    }

    word += char;
  }

  if (escaped) word += "\\";
  finishSegment();
  return segments;
}

function basename(command: string): string {
  return command.slice(command.lastIndexOf("/") + 1);
}

function skipOptions(
  words: string[],
  start: number,
  optionsWithValues: ReadonlySet<string>,
): number {
  let index = start;

  while (index < words.length) {
    const option = words[index];
    if (option === "--") return index + 1;
    if (!option.startsWith("-") || option === "-") return index;

    index += optionsWithValues.has(option) ? 2 : 1;
  }

  return index;
}

function executableIndex(words: string[]): number | undefined {
  let index = 0;

  while (index < words.length) {
    while (index < words.length && ASSIGNMENT.test(words[index])) index += 1;
    if (index >= words.length) return undefined;

    const wrapper = basename(words[index]);
    index += 1;

    if (wrapper === "command") {
      index = skipOptions(words, index, NO_OPTIONS_WITH_VALUES);
      continue;
    }
    if (wrapper === "env") {
      index = skipOptions(words, index, ENV_OPTIONS_WITH_VALUES);
      continue;
    }
    if (wrapper === "sudo") {
      index = skipOptions(words, index, SUDO_OPTIONS_WITH_VALUES);
      continue;
    }

    return index - 1;
  }

  return undefined;
}

function isDisallowedExecutable(executable: string): boolean {
  if (/(?:^|\/)\.?venv\/bin\/[^/]+$/.test(executable)) return true;

  const name = basename(executable);
  return (
    /^python(?:\d+(?:\.\d+)*)?$/.test(name) ||
    /^pypy(?:\d+(?:\.\d+)*)?$/.test(name) ||
    /^pip(?:\d+(?:\.\d+)*)?$/.test(name) ||
    name === "pipx" ||
    name === "poetry"
  );
}

export function containsDisallowedPythonCommand(command: string): boolean {
  if (!PYTHON_COMMAND_CANDIDATE.test(command)) return false;

  return commandSegments(command).some((words) => {
    const index = executableIndex(words);
    return index !== undefined && isDisallowedExecutable(words[index]);
  });
}

export default function uvGuardExtension(pi: ExtensionAPI): void {
  pi.on("tool_call", async (event) => {
    if (!isToolCallEventType("bash", event)) return undefined;
    if (!containsDisallowedPythonCommand(event.input.command)) return undefined;

    return { block: true, reason: DENIAL_REASON };
  });
}
