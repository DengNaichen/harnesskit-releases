# InfHarness Releases

This repository is the public distribution endpoint for the InfHarness CLI
and native Codex and Claude Code Plugins.
The private InfHarness monorepo remains the only editable source, build,
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

Windows x86_64 has a separate portable CLI; the curl installer does not
install it. macOS Intel is not published.

### Windows portable CLI

Download `harnesskit-vX.Y.Z-x86_64-pc-windows-msvc.zip` and its `.sha256` from the
same release. Compare `Get-FileHash <archive> -Algorithm SHA256` with that checksum,
then extract the ZIP to a local drive and run `./harnesskit.exe --help`.
No MSVC runtime installation is required. The binary is not Authenticode-signed.

Version 0.8.45 adds Windows agent integration support alongside `auth login/status/logout`,
repository inspection and explicit `refresher diff`. Setup/add/remove, MCP configuration,
doctor/report and Hook/team-sync entry points are available. Codex Marketplace metadata
and path handling, Qoder App discovery and Claude missing-MCP status are corrected.
Local file writes and repeat installation were verified for Codex, Claude, Cursor,
OpenCode, Qoder and InfCode Extension, with additional isolated native/package checks.

Before agent setup, place `harnesskit.exe` at
`%USERPROFILE%\.local\bin\harnesskit.exe`, the canonical Plugin launcher location.
Add that directory and Git for Windows `bin` / `usr\bin` to the host's PATH and restart
it; launchers require `sh` and `cygpath`. Run setup in a real Windows console.
Qoder App needs the generated ZIP imported; Cursor may need a window reload.

This is not a claim of complete Windows host or OAuth acceptance. Production login,
MCP connectivity, actual host loading and session Hooks require separate verification;
the full Windows test suite is not claimed green. InfCode IDE prerelease extensions
remain unsupported by the stable-version gate. Team sync requires compatible Backend
Windows support and migration 085, plus `include_rules` support for Rule sync.
Automatic CLI `update` and complete `uninstall` remain unavailable on Windows;
per-agent `remove` is available.

For a portable upgrade, close CLI processes, verify the new archive and replace
the executable. To remove it, delete the executable; run `auth logout` beforehand
if the current endpoint's Credential Manager entry should also be removed.
No installer modifies PATH or host configuration. UNC/device paths are unsupported.

## Set up coding agents

The native plugins call the canonical `~/.local/bin/harnesskit` installed above
with declaration format 1. The CLI checks operation compatibility and official
assets before handling the callback. Older CLIs reject the negotiation flag;
the launcher never retries without it. Codex exposes
`infharness-guide` plus the `infharness-memory-spike` and `infharness-refresher`
lifecycle Skills. Claude Code exposes the two lifecycle Skills. Cursor receives
the same Skills, Cursor-specific Hooks, and MCP declaration through its local native Plugin.

The Plugin package is now `infharness`, not `harness-agent`; Marketplaces are
`infharness-codex-marketplace` and `infharness-claude-marketplace`. MCP uses
`infharness` as server name, `infharness_context` and `infharness://`.
The OAuth client ID remains `harnesskit`; branding does not change that identity.
This is a breaking cutover with no old-name aliases or automatic brand migration.
Before upgrading, remove managed integrations and MCP entries with the old CLI,
and remove the old Plugin/Marketplaces using each host's Plugin manager. Then
install the new CLI, run setup, authenticate MCP again and start a new session.
Leaving the old Plugin enabled can run duplicate Hooks. The CLI command remains
`harnesskit`; local storage paths and release URLs are unchanged.

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

Cursor setup installs and verifies a receipt-owned native Plugin at
`~/.cursor/plugins/local/infharness`. Use the exact `cursor-agent --plugin-dir`
launch command printed by setup; the Plugin carries Skills, Hooks, and MCP together.

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
Standalone add/remove do not perform legacy migration. Cursor add/remove own only
the local native Plugin bundle and its private install receipt; `mcp setup --cursor`
installs the same bundle and prints the in-session authentication limitation.

## Update

Canonical `~/.local/bin/harnesskit` installations can update to the latest stable
release directly:

```sh
harnesskit update
```

The command verifies the published checksum and binary version before atomic
replacement, then the new CLI updates already installed official integrations.
It checks integrations even when the binary is already latest. It preserves service
configuration, authentication and disabled preferences, and does not enroll new agents.
An incomplete host update is reported separately and makes the command fail; rerun
`harnesskit update` to recover. Start a new agent session after upgrading.

Recorded official local Plugin bundles are verified before switching versions;
unknown sources, modified content and team additions are preserved and reported as
conflicts. Team asset migration is separate. Codex updates preserve its enabled
preference without reinstalling the Plugin; Claude uses its native update interface.

Non-canonical installations and automatic downgrades are rejected. Use the installer
with `--version X.Y.Z` for a fixed binary version; host integrations are not rolled back.
When upgrading from the older binary-only updater, run `harnesskit update` again
with the new CLI to complete integrations. For the retired parenthesized version-output
cutover, rerun the installer once, then refresh the InfHarness Plugin through the
new `harnesskit update` flow when its old source is a recorded official local bundle.

## Uninstall

Run `harnesskit uninstall` from the canonical `~/.local/bin/harnesskit` installation to
remove current Codex, Claude, Cursor, and InfCode deliveries, then delete the binary last.
Any delivery failure preserves the binary. Marketplace entries, external MCP
configuration, credentials, setup state, and the install directory are not removed.
Cursor Plugin MCP configuration and its ownership receipt are removed with that bundle. Non-canonical
executables are rejected before any delivery mutation.
