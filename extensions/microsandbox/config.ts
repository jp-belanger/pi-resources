import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

export interface MicrosandboxConfig {
  image: string;
  imageDigest?: string;
  cpus: number;
  memoryMiB: number;
  storageMiB: number;
  workspaceWriteMiB: number;
  maxCommandSeconds: number;
  guestUser: string;
  githubPatEnv?: string;
}

const ALLOWED_KEYS = new Set([
  "image",
  "imageDigest",
  "cpus",
  "memoryMiB",
  "storageMiB",
  "workspaceWriteMiB",
  "maxCommandSeconds",
  "guestUser",
  "githubPatEnv",
]);

function positiveInteger(
  value: unknown,
  name: string,
  maximum: number,
): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > maximum
  ) {
    throw new Error(`${name} must be an integer from 1 through ${maximum}`);
  }
  return value as number;
}

export function parseMicrosandboxConfig(value: unknown): MicrosandboxConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("configuration must be a JSON object");
  }

  const source = value as Record<string, unknown>;
  const unknownKeys = Object.keys(source).filter(
    (key) => !ALLOWED_KEYS.has(key),
  );
  if (unknownKeys.length > 0) {
    throw new Error(`unknown configuration keys: ${unknownKeys.join(", ")}`);
  }
  if (typeof source.image !== "string" || source.image.trim() === "") {
    throw new Error("image must be a non-empty OCI image reference");
  }

  const imageDigest = source.imageDigest;
  if (
    imageDigest !== undefined &&
    (typeof imageDigest !== "string" ||
      !/^sha256:[a-f0-9]{64}$/.test(imageDigest))
  ) {
    throw new Error("imageDigest must be a sha256 OCI manifest digest");
  }

  const guestUser = source.guestUser ?? "developer";
  if (typeof guestUser !== "string" || guestUser.trim() === "") {
    throw new Error("guestUser must be a non-empty string");
  }

  const githubPatEnv = source.githubPatEnv;
  if (
    githubPatEnv !== undefined &&
    (typeof githubPatEnv !== "string" ||
      !/^[A-Za-z_][A-Za-z0-9_]*$/.test(githubPatEnv))
  ) {
    throw new Error("githubPatEnv must be a valid environment variable name");
  }

  return {
    image: source.image.trim(),
    ...(imageDigest === undefined ? {} : { imageDigest }),
    cpus: positiveInteger(source.cpus ?? 8, "cpus", 256),
    memoryMiB: positiveInteger(
      source.memoryMiB ?? 16_384,
      "memoryMiB",
      1_048_576,
    ),
    storageMiB: positiveInteger(
      source.storageMiB ?? 30_720,
      "storageMiB",
      10_485_760,
    ),
    workspaceWriteMiB: positiveInteger(
      source.workspaceWriteMiB ?? 102_400,
      "workspaceWriteMiB",
      10_485_760,
    ),
    maxCommandSeconds: positiveInteger(
      source.maxCommandSeconds ?? 3_600,
      "maxCommandSeconds",
      86_400,
    ),
    guestUser: guestUser.trim(),
    ...(githubPatEnv === undefined ? {} : { githubPatEnv }),
  };
}

export function loadMicrosandboxConfig(
  configPath = join(getAgentDir(), "microsandbox.json"),
): MicrosandboxConfig {
  if (!existsSync(configPath)) {
    throw new Error(`missing trusted global configuration: ${configPath}`);
  }

  let value: unknown;
  try {
    value = JSON.parse(readFileSync(configPath, "utf8"));
  } catch (error) {
    throw new Error(
      `cannot parse ${configPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return parseMicrosandboxConfig(value);
}
