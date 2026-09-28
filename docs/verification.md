# Verification — 2026-09-28

Target: local Harness `00102833dfaee1da9f48a3a8eae9d34005a75218` plus the documented generic extensions; Node 24.19.0, macOS. The test Host used a separate source copy and DSH_HOME; no daily Sessions were copied.

| Layer | Evidence | Result |
| --- | --- | --- |
| Plugin logic and lifecycle | `npm test`: four files, 17 tests, including real file-backed Cordis Loader and disposal | Passed |
| Types and build | `npm run check`, `npm run build` | Passed |
| Host regression | llm-pi-ai suites: 14 files, 337 tests | Passed |
| Host documentation | `pnpm run doc-sync`: 42 gates | Passed |
| Supported install | `dsh plugin --profile web add link:<plugin>`; manifest bundle/dependency and `--dump-config` inspected | Passed |
| Migration | Dry-run logic and isolated `--apply`; original profile backed up; credentials retained as references | Passed |
| Real Host | Loaded Web composition and authenticated catalog API | Passed |
| Actual inference | Host LLM runtime: CodeBuddy `deepseek-v4.1-flash` and Go `space-bunny-free`, both returned `OK` and stop | Passed; [sanitized response](live-probe.json) |
| Browser | Settings → Models footer, live refresh, search, free filter; negative search removes all results | Verified against Host cache |
| Failure recovery | Initial public-fetch failure retained cached 125 rows and exposed error; manual refresh replaced observation time and cleared error | Passed |

The observation contained 43 Go entries (41 chat models; two zero-rate chat models) and 82 Zen entries (80 chat models; eleven zero-rate chat models plus one zero-rate non-chat Jev entry). Counts are observations, not fixtures or permanent promises. Protocols are per provider and model. Most catalog models were not called; paid models were not tested merely to enumerate them. Earlier direct-route probes returned OpenCode-only `FreeTierError` for Zen Big Pickle and MiMo; zero-rate discovery does not establish third-party access.

The local link installation and scoped tarball installation through `dsh plugin --profile web add <absolute-tarball>` are verified. The tarball was installed into a fresh home with a separate dependency tree and loaded by the compatible source Host; the authenticated catalog endpoint was exercised. The registry pi-ai catalog recognizes 35 Go chat models; six additional legacy models accepted by the patched development catalog remain diagnostic until their protocol metadata can be confirmed. Live membership remains 43 Go / 82 Zen entries, and the two Go zero-rate chat models remain available. Unmodified official Host compatibility is not claimed. Package inspection separately checks every declared runtime/client/type/bundle entry and excludes credentials, caches, sessions and logs.

## Daily deployment

Installed with the supported local-link workflow into the existing Web profile. The restarted Host returned HTTP 200 with no catalog error: Go 43 advertised / 41 chat / 2 zero-rate chat; Zen 82 advertised / 80 chat / 11 zero-rate chat. All 481 existing Sessions remained listed and idle at the deployment check. Other provider settings and unrelated profile rows were compared structurally against the backup and remained equal. A second migration run made no profile changes.

The install also repaired an existing stale WorkDAG dependency and bundle reference, from the removed `@workdag/w1` prototype path to the existing `dsh-workdag` package root. The original package manifest and profile were backed up before this repair. Pre-existing missing experimental agent-team-web-profile and modsearch settings API warnings remain outside this plugin.

## Release checks

The scoped package is `@foreveryu/dsh-opencode-go@0.1.0`; the unscoped npm name belongs to another author. The release source passed type checking, all 17 tests, build, and package entry inspection. Screenshots in `docs/media` come from an empty isolated Session and contain no authentication URL or credentials. Media is kept in Git and excluded from the npm tarball. Profile pnpm configuration explicitly declined the unused `@google/genai` and `protobufjs` dependency build scripts before installation. The Host resolves the declared peers from the compatible source checkout.
