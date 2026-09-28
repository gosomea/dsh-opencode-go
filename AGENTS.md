# dsh-opencode-go

本项目是 DeepSeek Harness 的外部插件。修改前阅读相邻 checkout 的 [AGENTS.md](../../deepseek-harness/AGENTS.md)、[packages/AGENTS.md](../../deepseek-harness/packages/AGENTS.md) 和 [defensive patterns](../../deepseek-harness/docs/defensive-patterns.md)。没有相邻 checkout 时，从目标 Host 仓库读取相同规范。

- OpenCode 目录、协议、会话头、费率和迁移属于本插件；Host 仅保留可复用的通用适配器接口。
- 每个网络操作有超时和取消；注册使用 Cordis effect，测试必须验证卸载撤销。失败保留最后成功快照，不静默伪造新目录。
- 凭据只通过 Host credential reference 解析，不进入缓存、日志、截图、Skill 或模型发现请求。
- 用 `npm run check`、`npm test`、`npm run build`、`npm run pack:check` 验证。产品行为需要真实 Loader 和独立 DSH_HOME 的 Web Host 验收；不能以 dump-config 代替加载验证。
- README 的 Model Experience、限制及兼容性随行为更新。新增界面文字进入中英 locale 字典。
- 修改 Host 时隔离源码和构建产物；日常部署前检查活跃会话，备份原配置。保留用户已调整的能力设置。
