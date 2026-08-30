# Harness Agent Releases

This repository is the public distribution endpoint for the Harness Agent CLI
and native Codex and Claude Code Plugins.
The private Harness Agent monorepo remains the only editable source, build,
signing, notarization, and verification authority. Files on `main` are
published projections and are not edited here.

## Install

Install the latest release to `~/.local/bin`:

```sh
curl -fsSL https://raw.githubusercontent.com/DengNaichen/harnesskit-releases/main/install.sh | sh
```

Install a fixed version:

```sh
curl -fsSL https://raw.githubusercontent.com/DengNaichen/harnesskit-releases/main/install.sh | sh -s -- --version X.Y.Z
```

The installer detects the supported platform, downloads the matching archive
and checksum from this repository's GitHub Releases, verifies SHA-256 and the
binary version, then atomically replaces `~/.local/bin/harnesskit`.

Supported platforms:

- macOS Apple Silicon
- Linux x86_64

Windows and macOS Intel are not currently published.

## Set up coding agents

The native plugins call the canonical `~/.local/bin/harnesskit` installed above
only after verifying a CLI version not older than the Plugin. This
allows `harnesskit update` before the host refreshes its Plugin. They bundle
the same three Harness Agent Skills and lifecycle Hook contracts for Codex and
Claude Code. Cursor uses the same canonical Skill bytes through its CLI-managed
direct integration.

```sh
harnesskit setup
```

Setup adds the public Marketplace and installs the native Plugin for Codex and
Claude Code. Cursor is CLI-managed: setup installs and verifies its direct Skills,
Hooks, and rule instead of adding a Marketplace.

The same setup journey configures MCP through its separate conflict, migration,
and OAuth ownership checks. Plugin installation never takes over an existing
same-name MCP server.

Cursor and InfCode are CLI-managed:

```sh
harnesskit install --cursor
harnesskit install --infcode
```

Existing Codex or Claude direct installations are bounded migration input, not a
supported installation fallback. They migrate only after Plugin install. Cursor has
no Plugin delivery path.

## Update

Canonical `~/.local/bin/harnesskit` installations can update to the latest stable
release directly:

```sh
harnesskit update
```

The command verifies the published SHA-256 checksum and downloaded binary version
before atomic replacement. It is a no-op at the latest version, does not downgrade,
and refuses to modify Homebrew or any other non-canonical installation. Use the
installer with `--version X.Y.Z` for a fixed version or rollback.
Installations whose `--version` still includes the retired parenthesized suffix must
rerun the installer once to cross that output cutover; later self-updates work normally.
Codex and Claude users must also refresh the Harness Agent Plugin from the host Plugin
manager so its launcher and the CLI cross the cutover together.
