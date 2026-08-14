# Pi Microsandbox extension

This extension keeps Pi on the host and routes Pi's built-in file tools, bash tool, and `!` commands through one local Microsandbox microVM per session. The current Pi working directory is the only project-data mount. It is available read-write at `/workspace`. A private host temporary directory is mounted read-only at `/run/pi-output` for full output from truncated bash commands.

## Prerequisites

- Linux with `/dev/kvm` available to the user
- Microsandbox 0.6.8
- Docker or another OCI image builder for the initial image build
- Node.js 22 or newer on the host

Check the runtime:

```sh
msb doctor
```

## Build and load the guest image

The image includes Git, GitHub CLI, Bash, ripgrep, `just`, build tools, Python support through `uv`, Rust, Node.js, and pnpm.

Use the repository recipe and supply the next image version:

```sh
just microsandbox-image-update 0.1.2
```

The recipe completes the full image update workflow: it builds the image, loads it into Microsandbox, reads its immutable manifest digest, and updates both `image` and `imageDigest` in `~/.pi/agent/microsandbox.json`. It preserves the other configuration fields. Set `PI_AGENT_DIR` when the Pi agent directory is not `~/.pi/agent`.

The extension sets pull policy to `never` and verifies the cached tag against `imageDigest` before it starts a VM.

### Pinning policy

The Ubuntu base is pinned by digest. Node.js and uv are pinned by version and verified with SHA-256 checksums. Rust and `just` are pinned by version. These pins make upgrades deliberate, reduce unexpected build changes, and make the resulting image easier to audit.

Pins require periodic maintenance to receive security and toolchain updates. Without pins, rebuilds can silently select new inputs and produce different behavior, but routine updates require less manual work. The image is not fully reproducible because Ubuntu packages and the Rust installer are retrieved from live repositories. Update the pins deliberately, use a new image version, and run the image update recipe so the trusted configuration receives the new manifest digest.

## Trusted global configuration

Create `~/.pi/agent/microsandbox.json`:

```json
{
  "image": "pi-microsandbox-dev:0.1.1",
  "imageDigest": "sha256:a1b6c6b0e7c2da098f9aa4b2485ead82e3ccd0e7e196c0ccc26006d4a12f7380",
  "cpus": 8,
  "memoryMiB": 16384,
  "storageMiB": 30720,
  "workspaceWriteMiB": 102400,
  "maxCommandSeconds": 3600,
  "guestUser": "developer"
}
```

The configuration is strict. Unknown keys, invalid values, or a missing file put the extension in a fail-closed state. `storageMiB` limits disposable guest-root storage. `workspaceWriteMiB` limits how much new data one VM can add to the host workspace; it does not reserve that space in advance.

### Optional GitHub PAT

Use a fine-grained, short-lived PAT with only the required repository and pull-request permissions. Add the host variable name to the trusted configuration:

```json
{
  "image": "pi-microsandbox-dev:0.1.1",
  "imageDigest": "sha256:a1b6c6b0e7c2da098f9aa4b2485ead82e3ccd0e7e196c0ccc26006d4a12f7380",
  "cpus": 8,
  "memoryMiB": 16384,
  "storageMiB": 30720,
  "workspaceWriteMiB": 102400,
  "maxCommandSeconds": 3600,
  "guestUser": "developer",
  "githubPatEnv": "GITHUB_PAT"
}
```

Export the value before starting Pi:

```sh
export GITHUB_PAT='github_pat_...'
pi
```

The guest receives only the `$MSB_GH_TOKEN` placeholder in `GH_TOKEN`. Microsandbox substitutes the real value at its TLS boundary only for `github.com` and `api.github.com`. A use at another host terminates the VM. The image configures Git HTTPS and `gh` to use this placeholder.

## Operation

- `/microsandbox` reports health and non-secret configuration.
- `/microsandbox-restart` discards and recreates the session VM.
- `pi --no-microsandbox` explicitly uses host tools and shows a persistent `UNSANDBOXED` warning.
- VM startup, configuration, or connection failures block tools. They never cause local fallback.
- Full output from truncated bash commands is available read-only under `/run/pi-output`. The extension uses a private host temporary directory and removes it when the session stops.

Project and third-party Pi extensions still run in the host Pi process. They are outside this isolation boundary.

## Validation

Use [STRESS-TEST.md](./STRESS-TEST.md) for the complete security and integration test plan.

Do not remove the existing permission and sandbox extensions until these checks pass:

```sh
pnpm run check
pi
```

In Pi, use `/microsandbox`, then verify:

```sh
!uname -a
!pwd
!git status
!uv --version
!cargo --version
!node --version
!pnpm --version
!gh auth status
```

Also verify that public web access works and that private, link-local, metadata, and host destinations are not reachable.
