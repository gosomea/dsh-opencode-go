# DSH 0.2.1-alpha.3 compatibility verification

Verified on 2026-10-15 with Node 24.19.0 and Host commit 571902028a75c64c1d767f4ae5fd099485f0ddf0. The plugin is 0.1.2; exact peer declarations retain rc.2 and add this alpha release.

## Checks

- `npm run check`, `npm test` (20 cases), `npm run build` and `npm run pack:check` passed against the current Host dependencies.
- The Loader fixture supplies an isolated fake launch credential. Current native model listing hides models when their configured credential is missing.
- Real local HTTP fixtures verify Completions, Responses and Anthropic dispatch, Session headers, prepared calls and concurrent route separation.
- Refresh tests cover current inference endpoints, legacy cache reading, rejected cross-route endpoints, failed-refresh cache retention and lifecycle disposal.
- The target CLI rejected the extracted 0.1.1 manifest before installation and accepted the 0.1.2 tarball without a compatibility exemption.

## Real Host

The dedicated home uses an isolated copy of daily dependencies, with only Base, Web, Supervisor 0.1.5, Team and OpenCode selected. No daily Sessions were copied. The standard CLI installed the tarball; the running catalog API, not a config dump, established plugin loading.

Live refresh succeeded with no error: 86 Console entries and 37 Go entries at 2026-10-15T12:08:07.370Z. The official protocol tables now name `/inference` and `/inference/go`; discovery follows those roots. Counts are point-in-time metadata, not account entitlement.

Fresh Sessions on deepseek-codebuddy/deepseek-v4.1-flash and opencode-go/deepseek-v4.1-flash both returned OPENCODE_COMPAT_OK, ended normally and made no tool calls. Their IDs are session-c1bcc8a0-f141-45a8-b3b4-91e53e0baf1d and session-96fa60df-f1b7-4989-90df-2370500af3c3.

## Limits and setup observations

The initial empty-profile install encountered mirror resolution and dependency-build policy failures. Final acceptance used copied daily dependencies in an independent home, not a fresh registry/store installation. During an earlier probe the source checkout was relocated; that Go turn reached the probe deadline and was explicitly cancelled. The final requests above used the consolidated source path and updated endpoints.

Browser interaction is recorded separately from these Host and wire checks. This run does not establish every model's upstream eligibility, Gemini requests, images, multi-turn tool replay or npm publication. Existing rc.2 evidence remains scoped to its original 0.1.1 artifact.
