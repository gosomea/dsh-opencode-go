# dsh-opencode-go

Live OpenCode Go and Zen catalogs for DeepSeek Harness, including current token rates, zero-rate filters, protocol selection and Session affinity headers. [简体中文](README.zh.md)

## Compatibility and installation

This source plugin requires the generic Host extensions described in [Host compatibility](docs/host-compatibility.md). It is tested against the locally patched DeepSeek Harness source checkout, not an unmodified public release. Node must satisfy `^22.19 || >=24`.

Install the published package into a compatible Host:

```sh
dsh plugin --profile web add @foreveryu/dsh-opencode-go@0.1.0
```

The unscoped npm name belongs to a different author. This project publishes only under `@foreveryu/dsh-opencode-go`. For an existing Go/Zen configuration, run the migration script from the installed package after reviewing its dry run.

Build using dependencies from that built checkout during local development:

```sh
node scripts/link-host.mjs /absolute/path/to/deepseek-harness
npm run check
npm test
npm run build
npm run pack:check
```

Install using the target checkout's `dsh` launcher and the intended `DSH_HOME`:

```sh
dsh plugin --profile web add link:/absolute/path/to/dsh-opencode-go
node /absolute/path/to/dsh-opencode-go/scripts/migrate.mjs --home /absolute/path/to/.dsh --profile web
node /absolute/path/to/dsh-opencode-go/scripts/migrate.mjs --home /absolute/path/to/.dsh --profile web --apply
```

The migration requires an existing `llm-pi-ai` profile patch. It moves configured `opencode-go` and `opencode` routes, retaining credential references, request settings and capability overrides that differ from current discovered metadata. Removed/unsupported model overrides remain stored but are not offered as live models. It backs up the exact original profile, detects intervening edits, and replaces the patch atomically. It never reads API key values. A dry run refreshes only the public catalog cache. Custom provider endpoints or protocol overrides require review before migration. Install into a dedicated home first when rebuilding the Host.

For a new installation, configure `opencode-go.providers` with `opencode-go: { apiKeyEnv: OPENCODE_GO_API_KEY }` and/or `opencode: { apiKeyEnv: OPENCODE_API_KEY }`. Add the same route IDs to `llm-pi-ai.excludedProviders`; remove their old generic-provider settings. Resolve those credential references through DSH credentials or the Host environment. An unconfigured plugin is dormant. The plugin's generated settings page exposes configuration; existing credential references continue to work.

## Use

Open **Settings → Models → OpenCode Go / Zen**. Refresh explicitly, search by model ID/name, or enable the zero-rate filter. Provider models appear automatically after a successful refresh; model descriptions also carry the rates. Separate Zen and Go tabs show compact price lists. Hover or keyboard-focus a model row for its ID, protocol, capacity, source, and access restrictions; unsupported entries carry a warning marker. New entries are discovered at startup and every six hours by default. `refreshIntervalMs: 0` disables periodic refresh; `sourceTimeoutMs` defaults to 30 seconds.

Go and Zen use separate `/models` lists. Exact provider/model identity is joined with the official protocol table, Models.dev capacity metadata and the installed pi-ai catalog. Unverified chat protocols or capacities are not invented. Inference requests carry `x-opencode-session` from the actual Session ID; standalone calls receive a new UUID. HTTP transport, streaming, tools, images and reasoning conversion use DSH's `PiAiAdapter`.

Rates are USD per million tokens: input, output, cache read and cache write. Unknown rates show `—`. A model is marked free only when both input and output are explicitly zero and known cache/tier rates do not charge. Go reference rates describe metadata, not subscription quota. Zen zero-rate models can require OpenCode's own client; the plugin reports that restriction and does not impersonate another client. Account credit, remaining quota and future promotional availability are not inferred.

The cache at `$DSH_HOME/plugins/dsh-opencode-go/catalog-v1.json` contains public metadata only. A failed refresh keeps the last validated snapshot and exposes the error and observation time. Abort and timeout cancel owned requests; unload withdraws provider, discovery and HTTP registrations. The authenticated Host exposes `GET/POST /api/opencode-go/catalog`; POST refreshes the catalog. No credential is sent to public metadata services or returned to the browser.

## Screenshots

Captured from an empty Session in an isolated, compatible DSH Host. Counts and rates are a point-in-time view, not account entitlement.

![Zen model settings](https://raw.githubusercontent.com/gosomea/dsh-opencode-go/main/docs/media/settings-zen.png)

![Go model settings](https://raw.githubusercontent.com/gosomea/dsh-opencode-go/main/docs/media/settings-go.png)

![Model details](https://raw.githubusercontent.com/gosomea/dsh-opencode-go/main/docs/media/model-details.png)

![Conversation model picker](https://raw.githubusercontent.com/gosomea/dsh-opencode-go/main/docs/media/model-picker.png)

## Model Experience

### OpenCode inference

#### What the model sees

The selected model receives DSH's existing pi-ai conversion of the Session messages, system prompt, tools and admitted images. This plugin adds no prompt, tool or hidden instruction. Session affinity is transmitted in an HTTP header. Catalog descriptions and prices are user-facing metadata.

#### Token effect

No additional prompt tokens. Discovery and pricing refreshes are public HTTP requests, not model inference. The selected provider determines billed tokens.

#### KV Cache effect

Session IDs stay stable across requests in one Session. This may support provider-side affinity but does not guarantee cache hits. Changing model, protocol or explicit capability overrides can change request conversion and invalidate prefix reuse.

## Verification and limitations

`npm test` covers fixed-source discovery, zero/unknown pricing, protocol routing, real HTTP request headers, cache failure/abort behavior, and a file-backed Loader composition with disposal. `npm run pack:check` inspects the distributable. Real-host evidence is recorded in [verification](docs/verification.md). Online access varies by account; discovery does not prove entitlement for every listed model.

The public documentation table is parsed as static HTML. An incompatible upstream table change fails refresh rather than silently reverting to a stale built-in list. There is no account-quota API integration, OAuth login flow, or automatic purchase. Only text/image input supported by DSH is advertised. Non-chat Jev `/systemone` entries remain diagnostic rows.

**Runtime invariant:** no companion is published. Adapter metadata and the HTTP/UI views derive from one committed catalog snapshot; there is no separately maintained event projection to compare. Validation, atomic cache publication and disposal tests enforce the owned behavior.

## Skill and removal

The accompanying [skill](skills/dsh-opencode-go/SKILL.md) describes refresh, repair and migration. Enable it by linking that directory under `$DSH_HOME/skills/dsh-opencode-go`, after checking an existing target. It is not enabled merely by being present in the package.

To roll back, restore the migration's exact `cordis.patch.yml` backup while the Host is idle, then remove the plugin with `dsh plugin --profile web remove @foreveryu/dsh-opencode-go`. Restoring the backup reassigns the canonical provider routes and removes their exclusion. Keep the backup until verification is complete; do not restore over unrelated later profile edits without merging them. The public cache can remain or be deleted independently.
