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

# Check formatting, linting, and tests.
check:
    pnpm run check
