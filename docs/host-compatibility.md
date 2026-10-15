# Host compatibility

Version 0.1.2 declares the tested DSH 0.2.0-rc.2 and 0.2.1-alpha.3 versions. The current-host acceptance is in [the 0.2.1-alpha.3 verification](alpha-compat-verification.md); the earlier 0.1.1 acceptance remains in [rc.2 verification](rc2-verification.md). Version 0.1.0 required a locally patched 0.1.7-alpha.2 Host. Do not apply those old patches to the current release.

The plugin constructs OpenCode providers with public pi-ai protocol factories and feeds resolved profiles into the public DSH `PiAiAdapter`. The native adapter still owns message conversion, attachments, reasoning validation, stream cancellation, attribution and token accounting. Per-model endpoint dispatch and request-local `x-opencode-session` headers belong to the plugin. Native configuration schemas supply stream and image defaults. No main-loop, sandbox, native build or private source imports are changed.

The native Host owns built-in configurable-provider directory entries. The plugin does not replace those registrations. Canonical `opencode` and `opencode-go` inference routes remain unchanged, but they must not also be configured in `llm-pi-ai.providers`. Configure credentials and overrides in the plugin settings, not the built-in provider editor. Native discovery exposes model identity and capacity; the plugin's authenticated catalog API and Models footer retain protocol, pricing and eligibility diagnostics. Inference listings include pricing descriptions.

`excludedProviders`, `resolvePiAiProfiles` and a constructor-level request-header callback are not required. Migration removes the obsolete exclusion field. Peer requirements name these exact versions; another pre-stable Host needs validation before widening them. On 0.2.1-alpha.3, native model listing hides routes whose named credential is missing; configured credential references must resolve before models are offered.

Discovery reads the current official `/inference` and `/inference/go` model endpoints and Console protocol tables. Cache validation accepts only the matching route’s current or legacy official root. Cross-route endpoints and arbitrary redirects are rejected.
