# Harness Agent Releases

This repository is the public distribution endpoint for the Harness Agent CLI
and native Codex, Claude Code, and Cursor Plugins.
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

## Install an agent plugin

The native plugins call the canonical `~/.local/bin/harnesskit` installed above
only after verifying contract 6 and a CLI version not older than the Plugin. This
allows `harnesskit update` before the host refreshes its Plugin. They bundle
the same three Harness Agent Skills and lifecycle Hook contracts for Codex,
Claude Code, and Cursor.

Codex:

If the target host already uses a direct CLI-managed integration, remove that
ownership before installing its Plugin:

```sh
harnesskit uninstall --codex   # or --claude / --cursor
```

Codex and Cursor legacy installs share `~/.agents/skills`; reinstall the other
legacy host afterward only when it intentionally remains on the legacy path.

```sh
codex plugin marketplace add DengNaichen/harnesskit-releases
codex plugin add harness-agent@harness-agent-codex-marketplace
```

Claude Code, from an interactive session:

```text
/plugin marketplace add DengNaichen/harnesskit-releases
/plugin install harness-agent@harness-agent-claude-marketplace
```

Cursor:

```sh
cursor-agent plugin marketplace add https://github.com/DengNaichen/harnesskit-releases
```

Then enable `harness-agent` from Cursor's `/plugins` interface. Cursor Agent
currently exposes marketplace management but no non-interactive plugin install
command.

Plugin installation does not take over an existing same-name MCP server. Connect
the host separately with `harnesskit mcp setup --codex`, `--claude`, or `--cursor`
so the existing conflict, migration, and OAuth ownership checks remain in force.

InfCode remains CLI-managed:

```sh
harnesskit install --infcode
```

Existing Codex, Claude, or Cursor installations made with `harnesskit install`
remain supported, but must not be enabled alongside the native Plugin for the
same host.

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
