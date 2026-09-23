### DW-1: mise.toml pins node = "lts", which will float to Node 26 on 2026-10-28 while the Bridge targets node24 and @types/node 24.
origin: spec-deferred 323559681196
location: mise.toml:5
source_spec: `spec-1-1-the-monorepo-scaffold-that-contract-cannot-exist-without.md`
severity: medium
reason: mise.toml [tools] node = "lts" resolves to 24.15.0 today; epic context says the systemd ExecStart must use an absolute pinned Node 24.15.x path and that mise moves to Node 26 LTS on 2026-10-28.
status: open

### DW-2: mise run version:check reports no version found in any manifest file.
origin: spec-deferred a6d5506cc2ef
location: .mise/scripts/versioning.sh
source_spec: `spec-1-1-the-monorepo-scaffold-that-contract-cannot-exist-without.md`
severity: low
reason: Root package.json carries no version and packages are 0.0.0; the managed mise-versioning script finds nothing to keep in parity. Pre-existing managed block, not changed by this story.
status: open
