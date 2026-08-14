#!/usr/bin/env bash
set -euo pipefail

version=${1:-}
if [[ -z "$version" ]]; then
  printf 'Usage: %s VERSION\nExample: %s 0.1.2\n' "$0" "$0" >&2
  exit 2
fi

repo_root=$(git rev-parse --show-toplevel)
image="pi-microsandbox-dev:${version}"
archive=$(mktemp --suffix=.tar)
config=${PI_AGENT_DIR:-"$HOME/.pi/agent"}/microsandbox.json
trap 'rm -f "$archive"' EXIT

printf 'Building %s\n' "$image"
docker build \
  --file "$repo_root/extensions/microsandbox/Containerfile" \
  --tag "$image" \
  "$repo_root/extensions/microsandbox"

printf 'Loading %s into Microsandbox\n' "$image"
docker save "$image" --output "$archive"
msb load --input "$archive" --tag "$image"

digest=$(msb image inspect "$image" --format json | jq -r \
  '.digest // .manifestDigest // .manifest_digest // .handle.manifestDigest // .handle.manifest_digest // empty')
if [[ ! "$digest" =~ ^sha256:[a-f0-9]{64}$ ]]; then
  printf 'Could not read the manifest digest for %s\n' "$image" >&2
  msb image inspect "$image" >&2
  exit 1
fi

mkdir -p "$(dirname "$config")"
if [[ -f "$config" ]]; then
  temporary_config=$(mktemp "${config}.XXXXXX")
  jq --arg image "$image" --arg digest "$digest" \
    '.image = $image | .imageDigest = $digest' "$config" > "$temporary_config"
  chmod --reference="$config" "$temporary_config"
  mv "$temporary_config" "$config"
else
  cat > "$config" <<EOF
{
  "image": "$image",
  "imageDigest": "$digest",
  "cpus": 8,
  "memoryMiB": 16384,
  "storageMiB": 30720,
  "workspaceWriteMiB": 102400,
  "maxCommandSeconds": 3600,
  "guestUser": "developer"
}
EOF
fi

printf '\nLoaded %s\nDigest: %s\nUpdated: %s\n' "$image" "$digest" "$config"
