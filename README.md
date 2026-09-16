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
the same two Harness Agent Skills and lifecycle Hook contracts for Codex and
Claude Code. Cursor uses the same canonical Skill bytes through its CLI-managed
direct integration.

```sh
harnesskit setup
```

The CLI embeds the complete Plugin, including Skills, Hooks, manifests, launcher,
VERSION and Marketplace catalogs. Setup extracts it into
`~/.harnesskit/plugin-marketplaces/<bundle-sha256>/` and installs it through a local
Marketplace for Codex and Claude Code, without downloading Plugin assets from GitHub.
Existing Marketplaces with a different source are preserved and reported as conflicts;
remove the old Marketplace through the host Plugin manager before installing this bundle.
Use the same procedure when upgrading to a CLI with different Plugin assets.
Extracted bundles are retained on uninstall. MCP still requires access to its service.

Cursor is CLI-managed: setup installs and verifies its direct Skills,
Hooks, and rule instead of adding a Marketplace.

The same setup journey configures MCP through its separate conflict, migration,
and OAuth ownership checks. Plugin installation never takes over an existing
same-name MCP server.

Standalone delivery management is symmetric across all four hosts:

```sh
harnesskit add --codex
harnesskit add --claude
harnesskit add --cursor
harnesskit add --infcode
harnesskit remove --codex
harnesskit remove --claude
harnesskit remove --cursor
harnesskit remove --infcode
```

Existing Codex or Claude direct installations are bounded migration input, not a
supported installation fallback. Guided setup migrates them only after Plugin install.
Standalone add/remove do not configure MCP or run legacy migration. Cursor has
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

## Uninstall

Run `harnesskit uninstall` from the canonical `~/.local/bin/harnesskit` installation to
remove current Codex, Claude, Cursor, and InfCode deliveries, then delete the binary last.
Any delivery failure preserves the binary. Marketplace entries, MCP configuration,
credentials, setup state, and the install directory are not removed. Non-canonical
executables are rejected before any delivery mutation.
