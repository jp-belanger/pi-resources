set shell := ["bash", "-euo", "pipefail", "-c"]

# List available recipes.
default:
    @just --list

# Remove installed dependencies.
clean:
    rm -rf node_modules

# Install dependencies from the lockfile.
install:
    pnpm install --frozen-lockfile

# Update dev dependencies to the newest versions at least 10 days old.
update:
    pnpm update --latest

# Auto-fix formatting and lint, then fail on anything left, including type errors.
check:
    pnpm run check
