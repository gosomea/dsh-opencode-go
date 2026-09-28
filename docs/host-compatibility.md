# Host compatibility

The local target is DeepSeek Harness commit `00102833dfaee1da9f48a3a8eae9d34005a75218` plus the following generic extensions. A normal package install does not patch the Host. Verify capabilities before enabling the plugin on another installation.

- `@deepseek-ai/dsh-llm-pi-ai` exports `resolvePiAiProfiles`, `PiAiAuthInjection` and `PiAiAdapterOptions`.
- `PiAiAdapterOptions.requestHeaders(options)` supplies request-local headers, with case-insensitive replacement of configured headers while preserving Harness attribution. The plugin supplies OpenCode Session affinity here.
- `llm-pi-ai.excludedProviders` releases built-in configurable-provider directory entries to external adapters. Configuring and excluding the same route is rejected.
- Model profiles accept per-model `api`, `baseURL` and `description`. These permit a provider to serve mixed wire protocols without changing canonical model identities.
- `LlmDiscoveredModel` and its service projection preserve `description`, `configuration` and `unavailableReason`. The built-in model surfaces display descriptions and preserve adopted protocol configuration.
- Existing `settings.models.footer`, browser locale, authenticated Web route registration, LLM registration and credential lookup are reused without an OpenCode branch in core.

OpenCode-specific discovery and request routing live entirely in this package. The earlier direct-source `opencode-discovery.ts` and hostname-based header injection are removed from the adapted Host. The skill's reference patch carries the current generic changes for inspection; check it against the target checkout before applying. Never force a patch over unrelated work.
