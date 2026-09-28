# 插件实现与 Host 扩展

OpenCode 专用逻辑位于 `dsh-opencode-go` 插件的 `src/discovery.ts`、`src/catalog.ts`、`src/index.ts` 与 `src/client/`。公共缓存采用版本化 JSON、原子替换、最后成功快照；插件负责定时刷新、模型路由、Session header、费率和诊断。`scripts/migrate.mjs` 将现有配置迁入插件，同时释放 llm-pi-ai 的对应目录。

Host 只保留可供外部适配器使用的通用能力：`resolvePiAiProfiles`、`PiAiAdapterOptions.requestHeaders`、`excludedProviders`、逐模型协议/端点/描述，以及 LLM discovery 元数据透传和界面显示。不要重新加入 OpenCode 域名判断或专用远程目录分支。

`source-changes.patch` 是参考 Host 工作区相对基线的通用变更，应用前执行 `git apply --check`。源码版本、已安装能力或已有修改不同，应按插件 `docs/host-compatibility.md` 移植。补丁不能代替插件安装。旧 `sync-models.mjs` 不再是安装路径，自动目录现在由插件维护；使用插件迁移脚本与刷新接口。
