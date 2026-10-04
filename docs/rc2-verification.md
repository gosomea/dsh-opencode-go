# Official Host 0.2.0-rc.2 verification

Tested on 2026-10-04 with the unmodified `dsh-v0.2.0-rc.2` source at `639ed015397290b3745d163aafe02ffee4aa3f84`, Node 24.19.0 and the 0.1.1 plugin candidate. Installation used `dsh plugin --profile web add file:<packed artifact>` in a separate DSH home. No Host source or sandbox changes were made.

- `npm run check`, `npm test` (18 tests), `npm run build`, and `npm run pack:check` passed.
- Real Loader composition covered catalog refresh, native-directory coexistence and withdrawal of adapter, discovery and directory registrations on disposal.
- Local HTTP fixtures covered OpenAI Completions, Responses and Anthropic dispatch; repeated, prepared and concurrent requests retained their own Session header. Mixed protocols on one route reached distinct endpoints. Unaffiliated calls used independent UUIDs.
- The authenticated real Host catalog returned 86 Zen and 43 Go entries with no refresh error. The selectable catalog contained 84 Zen and 34 Go models; other entries retained diagnostics rather than being silently advertised as usable. These are observation-time counts.
- A fresh Session using the daily CodeBuddy `deepseek-v4.1-flash` route returned the requested Chinese response. A separate Session using `opencode-go / deepseek-v4.1-flash` also returned it, with actual input and output usage recorded.
- The first isolated OpenCode request lacked its credential reference and ended with `MISSING_CREDENTIAL`, without output or charged-token usage in the Session. Copying the existing authorized reference into the private isolated store and restarting resolved this setup issue. No secret is included in these records.
- The same Host also loaded Supervisor 0.1.1, Bigfish, WorkDAG, GenUI, Modsearch, Archify, Argo and the current Agent Team profile. Bigfish and WorkDAG APIs responded; native model catalog reported no provider failures. Client resource batches returned HTTP 200.
- Browser automation returned `ERR_BLOCKED_BY_CLIENT`. Visual appearance, clicks and hover behavior remain unverified; successful resource delivery does not establish browser execution.

The adapter was subsequently installed from the packed artifact into the idle daily `web-rc2` profile. The default stayed `deepseek-codebuddy / deepseek-v4.1-flash`; all 488 existing Sessions remained visible and no queued task was interrupted. The official Host checkout remained clean. The original source checkout and old Web profile were retained.

This candidate has not been published to npm. The npm 0.1.0 package still requires its old Host extensions. Native OpenCode settings-directory ownership remains with `llm-pi-ai`; plugin credentials and tuning belong to the plugin settings. Free-tier account eligibility, Gemini wire requests, image inputs and multi-turn tool replay were not exercised against real upstream APIs in this acceptance run.
