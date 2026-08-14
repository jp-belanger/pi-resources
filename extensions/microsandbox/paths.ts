import path from "node:path";

export const GUEST_WORKSPACE = "/workspace";
export const GUEST_OUTPUT_DIRECTORY = "/run/pi-output";

function withoutAtPrefix(value: string): string {
  return value.startsWith("@") ? value.slice(1) : value;
}

function isInside(root: string, value: string): boolean {
  const relative = path.posix.relative(root, value);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.posix.isAbsolute(relative))
  );
}

export function toGuestToolPath(value: string): string {
  const input = withoutAtPrefix(value.trim());
  const resolved = path.posix.resolve(GUEST_WORKSPACE, input || ".");
  if (!isInside(GUEST_WORKSPACE, resolved)) {
    throw new Error(`path is outside ${GUEST_WORKSPACE}: ${value}`);
  }
  return resolved;
}

export function toGuestReadPath(value: string): string {
  const input = withoutAtPrefix(value.trim());
  if (path.posix.isAbsolute(input)) {
    const resolved = path.posix.resolve(input);
    if (isInside(GUEST_OUTPUT_DIRECTORY, resolved)) return resolved;
  }
  return toGuestToolPath(value);
}

export function hostCwdToGuest(workspace: string, cwd: string): string {
  const posixCwd = cwd.replaceAll("\\", "/");
  if (
    posixCwd === GUEST_WORKSPACE ||
    posixCwd.startsWith(`${GUEST_WORKSPACE}/`)
  ) {
    return toGuestToolPath(posixCwd);
  }

  const hostWorkspace = path.resolve(workspace);
  const hostCwd = path.resolve(cwd);
  const relative = path.relative(hostWorkspace, hostCwd);
  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    relative.split(path.sep).includes("..")
  ) {
    throw new Error(
      `working directory is outside the mounted workspace: ${cwd}`,
    );
  }
  return relative
    ? path.posix.join(GUEST_WORKSPACE, relative.split(path.sep).join("/"))
    : GUEST_WORKSPACE;
}

export function guestRelativePath(value: string): string {
  const guestPath = toGuestToolPath(value);
  return path.posix.relative(GUEST_WORKSPACE, guestPath) || ".";
}
