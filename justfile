set shell := ["bash", "-euo", "pipefail", "-c"]

# List available recipes.
default:
  @just --list

# Check formatting and lint extension sources.
check:
  pnpm run check
