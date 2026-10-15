# DSH 0.2.1-alpha.3 兼容性验证

2026-10-15 使用 Node 24.19.0 与 Host 提交 571902028a75c64c1d767f4ae5fd099485f0ddf0 验证。插件版本为 0.1.2；peer 声明保留 rc.2 并精确加入本次 alpha 版本。

## 检查

- 基于当前 Host 依赖的 `npm run check`、`npm test`（20 项）、`npm run build` 和 `npm run pack:check` 均通过。
- Loader 用例提供隔离假凭据；当前原生模型列表会隐藏配置凭据缺失的模型。
- 真实本地 HTTP 用例验证 Completions、Responses 与 Anthropic 分派、Session 请求头、预备调用及并发路由分离。
- 刷新测试覆盖当前推理地址、旧缓存读取、拒绝跨计费路由地址、刷新失败保留缓存及生命周期清理。
- 目标 CLI 在安装前拒绝提取出的 0.1.1 manifest，并接受 0.1.2 压缩包，没有授予版本豁免。

## 真实 Host

独立 home 使用日常依赖的隔离副本，只启用 Base、Web、Supervisor 0.1.5、Team 与 OpenCode；没有复制日常 Session。标准 CLI 完成压缩包安装，实际运行的目录 API 确认插件加载，证据不依赖配置导出。

实时刷新成功且错误为空：2026-10-15T12:08:07.370Z 观测到 Console 86 项、Go 37 项。官方协议表现使用 `/inference` 和 `/inference/go`，发现逻辑已采用对应根地址。数量只代表当时元数据，不代表账号调用权限。

deepseek-codebuddy/deepseek-v4.1-flash 与 opencode-go/deepseek-v4.1-flash 的新 Session 均返回 OPENCODE_COMPAT_OK，正常结束且没有工具调用。Session ID 分别为 session-c1bcc8a0-f141-45a8-b3b4-91e53e0baf1d 和 session-96fa60df-f1b7-4989-90df-2370500af3c3。

## 局限与环境观察

首次空 profile 安装遇到镜像解析与依赖构建策略失败；最终验收使用独立 home 中的日常依赖副本，不属于空缓存的 registry 安装验证。较早一次探测期间源码目录发生迁移，该 Go 轮次到达探测截止并已显式取消。上述最终请求使用归并后的源码路径和新端点。

浏览器交互与这些 Host、HTTP 检查分别记录。本轮不证明所有模型的上游准入、Gemini 请求、图像、多轮工具回放或 npm 发布。已有 rc.2 证据仍绑定原来的 0.1.1 产物。
