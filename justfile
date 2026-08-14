set shell := ["bash", "-euo", "pipefail", "-c"]

# List available recipes.
default:
  @just --list

# Check formatting, types, and tests.
check:
  pnpm run check

# Build and load a new guest image, then activate its tag and immutable digest.
microsandbox-image-update version:
  bash extensions/microsandbox/build-image.sh "{{version}}"
