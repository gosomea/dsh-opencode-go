---
name: dsh-opencode-go
description: 安装、迁移和维护 DSH 的 dsh-opencode-go 插件，实时识别 OpenCode Go/Zen 模型、协议、免费费率和准入限制，修复 MissingSessionID；用于模型列表落后、免费模型缺失或要求刷新价格。
---

# DSH OpenCode Go / Zen

通过独立 `dsh-opencode-go` 插件维护目录、协议、会话头和费率。先确定 `dsh-web` 实际指向的源码 checkout、Node、DSH_HOME、profile 及活跃任务；遵循目标仓库 AGENTS.md，保留现有修改。重编译 Host 时使用独立源码副本和测试 home，验证后在日常实例空闲时部署。

## 插件与 Host

本机插件项目位于工作区的 `projects/agent-research/deepseek-harness-plugins/dsh-opencode-go`。在其他机器从已安装 `@foreveryu/dsh-opencode-go/package.json` 定位插件，不能依赖开发机绝对路径。阅读插件 README 和 `docs/host-compatibility.md`。

0.1.1 使用官方 DSH 0.2.0-rc.2 的公开 PiAiAdapter 和 pi-ai provider API，无需 Host 补丁。0.1.0 的参考补丁仅用于旧版本，不再移植到新 Host。模型协议、会话头和目录详情由插件维护；原生目录仍指向内置设置，插件凭据与调优请在插件设置页修改。

## 发现规则

- Go 与 Zen 各自的 `/models` 是成员来源，禁止把 Zen 模型列表放进 Go。公开地址分别是 `https://opencode.ai/zen/go/v1/models`、`https://opencode.ai/zen/v1/models`。
- 按精确 ID 对齐[Go 官方协议表](https://opencode.ai/docs/go/#endpoints)、[Zen 官方协议表](https://opencode.ai/docs/zen/#endpoints)和 [Models.dev](https://models.dev/api.json)，不凭名字猜协议。MiniMax、Qwen 在不同路由可能使用不同协议。
- 协议和容量可靠后才加入聊天目录；Jev `/systemone`、无法确认的别名留作诊断。只声明 DSH 支持的 text/image 输入。保留显式用户能力调优。
- 费率注明美元/百万 token、来源和获取时间，含输入/输出/缓存读/缓存写；未知不能补零。有更高上下文分档须明确提示。Go 参考费率与订阅额度分开。
- 输入输出明确为零，且已知缓存和分档不收费，才标记免费。不能仅按 `-free` 后缀。零价不证明剩余额度、无限使用或第三方准入。Zen 可能返回 `403 FreeTierError`，仅限 OpenCode 内使用；记录限制，不伪造客户端身份。
- 元数据请求不发 API key。推理复用实际 Session ID 发送 `x-opencode-session`，独立调用使用独立 UUID。

## 安装和迁移

先在独立 home 用目标 checkout 的启动器安装：

```sh
dsh plugin --profile web add link:/absolute/path/to/dsh-opencode-go
node /absolute/path/to/dsh-opencode-go/scripts/migrate.mjs --home /absolute/path/to/.dsh --profile web
node /absolute/path/to/dsh-opencode-go/scripts/migrate.mjs --home /absolute/path/to/.dsh --profile web --apply
```

用户已经要求安装时完成预演后直接 apply，无需重复确认。迁移要求一个 `llm-pi-ai` patch 行，保留凭据引用和显式能力差异，移动 OpenCode routes 并删除旧的 `excludedProviders` 字段。先备份原文件、验证配置、检查并发编辑，最终原子替换。已有自定义 endpoint/api 必须核对，不能盲目迁移。检查报告中未服务项、免费项和实际模型数量，不把历史数量写成永久事实。

目录保存在 `$DSH_HOME/plugins/dsh-opencode-go/catalog-v1.json`，默认启动和每六小时刷新。用户可在设置 → 模型的插件面板手动刷新、搜索或仅看零费率；Host 的认证 `POST /api/opencode-go/catalog` 也能刷新。失败保留最后成功快照并暴露错误。自动发现的列表不再全量固定写入 profile。

将本技能目录软链接到 `$DSH_HOME/skills/dsh-opencode-go`；先检查已有目标，不能覆盖不同文件。随包 skill 与启用后的 skill 是两回事。

## 验收和回滚

跑插件 check、test、build、pack:check，以及 Host 相关测试与 doc-sync。通过正式 plugin add 和 dump-config 验证组合，再启动真实 Host 确认目录、费率、过滤和刷新。Loader 配置存在不等于插件已成功加载。验证 fiber dispose 撤销注册、刷新失败保留缓存、协议和会话头经过真实 HTTP。

仅用已有授权凭据做最小请求，优先确认零价模型，不批量调用付费模型。报告实际调用结果及未测权限，禁止用公开目录代替真实可调用证明。日常部署前确认没有活跃模型任务，不在重建时覆盖它正在服务的资源。

回滚恢复迁移留下的原 profile，再移除插件；有后续配置修改时合并恢复而非整文件覆盖。交付插件目录、技能目录、备份、验证记录和当前可用性限制。
