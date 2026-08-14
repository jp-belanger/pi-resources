import assert from "node:assert/strict";
import test from "node:test";
import { parseMicrosandboxConfig } from "../extensions/microsandbox/config.ts";
import { createSandboxName } from "../extensions/microsandbox/index.ts";
import {
  guestRelativePath,
  hostCwdToGuest,
  toGuestReadPath,
  toGuestToolPath,
} from "../extensions/microsandbox/paths.ts";

test("uses secure resource defaults", () => {
  assert.deepEqual(parseMicrosandboxConfig({ image: "pi-dev:local" }), {
    image: "pi-dev:local",
    cpus: 8,
    memoryMiB: 16_384,
    storageMiB: 30_720,
    workspaceWriteMiB: 102_400,
    maxCommandSeconds: 3_600,
    guestUser: "developer",
  });
});

test("rejects invalid and unknown configuration", () => {
  assert.throws(() => parseMicrosandboxConfig({}), /image/);
  assert.throws(() => parseMicrosandboxConfig({ image: "x", cpus: 0 }), /cpus/);
  assert.throws(
    () => parseMicrosandboxConfig({ image: "x", workspaceWriteMiB: 0 }),
    /workspaceWriteMiB/,
  );
  assert.throws(
    () => parseMicrosandboxConfig({ image: "x", unexpected: true }),
    /unknown configuration keys/,
  );
  assert.throws(
    () => parseMicrosandboxConfig({ image: "x", githubPatEnv: "BAD-NAME" }),
    /githubPatEnv/,
  );
  assert.throws(
    () => parseMicrosandboxConfig({ image: "x", imageDigest: "sha256:bad" }),
    /imageDigest/,
  );
});

test("maps only paths inside the guest workspace", () => {
  assert.equal(toGuestToolPath("src/main.ts"), "/workspace/src/main.ts");
  assert.equal(toGuestToolPath("@README.md"), "/workspace/README.md");
  assert.equal(toGuestToolPath("/workspace/src"), "/workspace/src");
  assert.equal(guestRelativePath("/workspace/src"), "src");
  assert.equal(
    toGuestReadPath("/run/pi-output/command.log"),
    "/run/pi-output/command.log",
  );
  assert.throws(() => toGuestToolPath("../secret"), /outside/);
  assert.throws(() => toGuestToolPath("/etc/passwd"), /outside/);
  assert.throws(() => toGuestToolPath("/run/pi-output/command.log"), /outside/);
  assert.throws(() => toGuestReadPath("/run/pi-output/../secret"), /outside/);
});

test("maps host working directories without allowing escape", () => {
  assert.equal(hostCwdToGuest("/work/project", "/work/project"), "/workspace");
  assert.equal(hostCwdToGuest("/work/project", "/workspace"), "/workspace");
  assert.equal(
    hostCwdToGuest("/work/project", "/workspace/packages/api"),
    "/workspace/packages/api",
  );
  assert.equal(
    hostCwdToGuest("/work/project", "/work/project/packages/api"),
    "/workspace/packages/api",
  );
  assert.throws(
    () => hostCwdToGuest("/work/project", "/work/other"),
    /outside/,
  );
});

test("creates bounded unique sandbox names", () => {
  const first = createSandboxName("session with unsafe/value");
  const second = createSandboxName("session with unsafe/value");
  assert.match(first, /^pi-session-with-unsafe-value-[a-f0-9]{12}$/);
  assert.notEqual(first, second);
  assert.ok(Buffer.byteLength(createSandboxName("x".repeat(500))) <= 128);
});
