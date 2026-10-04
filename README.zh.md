# dsh-opencode-go

为 DeepSeek Harness 实时发现 OpenCode Go / Zen 模型，显示免费标记和 token 费率，并按模型选择正确协议、发送实际 Session ID。[English](README.md)

## 安装与兼容性

0.1.1 使用官方 DSH 0.2.0-rc.2 的公开 API，协议分派与会话请求头由插件实现，无需修改 Host；0.1.0 才依赖旧源码扩展。详见[兼容性说明](docs/host-compatibility.md)和[本轮验收记录](docs/rc2-verification.md)。Node 要求 `^22.19 || >=24`。

本次源码适配先构建、打包，再把生成的 tarball 安装到目标 Host。npm 0.1.0 仍是需要旧 Host 补丁的版本；0.1.1 的发布需要另外完成：

```sh
npm run build
npm pack
dsh plugin --profile web add file:/absolute/path/foreveryu-dsh-opencode-go-0.1.1.tgz@0.1.0
```

npm 未加 scope 的同名包属于其他作者，本项目仅发布为 `@foreveryu/dsh-opencode-go`。已有 Go / Zen 配置时，从安装后的包目录运行迁移脚本，先核对预演结果。源码开发和迁移示例：

```sh
node scripts/link-host.mjs /absolute/path/to/deepseek-harness
npm run check
npm test
npm run build
npm run pack:check
dsh plugin --profile web add link:/absolute/path/to/dsh-opencode-go
node /absolute/path/to/dsh-opencode-go/scripts/migrate.mjs --home /absolute/path/to/.dsh --profile web
node /absolute/path/to/dsh-opencode-go/scripts/migrate.mjs --home /absolute/path/to/.dsh --profile web --apply
```

命令使用目标源码 checkout 的 `dsh` 和实际 `DSH_HOME`。先在独立 home 验证，重编译 Host 时还需独立源码副本。迁移要求已有 `llm-pi-ai` profile patch，将 Go / Zen 配置及凭据引用移到插件，并移除通用适配器中的对应路由配置；保留与实时元数据不同的显式能力设置。已下架或不支持的模型覆盖仍保留在配置中，但不会冒充实时可用模型。脚本备份原始文件、检查并发编辑、原子替换，不读取密钥值。默认预演只更新公共缓存；自定义 endpoint/api 必须先人工核对。

新配置可使用 `opencode-go.providers.opencode-go.apiKeyEnv: OPENCODE_GO_API_KEY` 和 `opencode-go.providers.opencode.apiKeyEnv: OPENCODE_API_KEY`。凭据通过 DSH 凭据存储或启动环境提供。从 `llm-pi-ai.providers` 移除已交给插件的路由；官方版本不支持 `excludedProviders`，不要添加该字段。没有 provider 配置时插件保持空目录，配置入口在插件生成的设置页。官方内置 OpenCode 目录仍指向原生设置，因此插件的凭据与能力调优应在本插件设置中修改。实时协议、价格和不可用原因由模型页面的插件面板展示。

## 使用与数据

打开**设置 → 模型 → OpenCode Go / Zen**，可刷新、搜索、只看零费率模型。成功刷新后聊天模型自动出现在模型选择器，描述中带价格；Zen 与 Go 分页展示紧凑价格列表。悬停或用键盘聚焦模型行，可查看 ID、协议、容量、来源和调用限制；不能安装的项带有警示标记。默认启动刷新、每六小时刷新；`refreshIntervalMs: 0` 关闭定时刷新，`sourceTimeoutMs` 默认 30 秒。

Go / Zen 分别读取自己的实时 `/models`，按精确 provider/model ID 关联官方协议表、Models.dev 和已安装 pi-ai 能力目录。不凭名称猜协议，不混用 Go / Zen 列表。推理复用 DSH `PiAiAdapter`，会话头使用真实 Session ID；无 Session 的独立请求使用独立 UUID。

价格单位是美元/百万 token，包含输入、输出、缓存读、缓存写，未知显示 `—`。仅输入输出明确为零且已知缓存和分档都不收费时标记免费。Go 参考价格不代表订阅剩余额度；Zen 零费率模型可能只允许 OpenCode 客户端使用。插件保留准入限制说明，不伪装客户端身份，也不承诺无限免费。

缓存位于 `$DSH_HOME/plugins/dsh-opencode-go/catalog-v1.json`，只含公共模型元数据。失败保留最后成功快照，并展示错误和获取时间。卸载取消请求、定时器并注销 provider、发现服务和 HTTP 路由。Host 已认证的 `GET/POST /api/opencode-go/catalog` 用于查询/刷新，不向浏览器返回凭据，也不向公共元数据服务发送推理密钥。

## 界面截图

来自独立兼容 DSH Host 的空白会话。数量和价格是获取时的快照，不代表账户调用权限。

![设置：Zen 费率列表](https://raw.githubusercontent.com/gosomea/dsh-opencode-go/main/docs/media/settings-zen.png)

![设置：Go 参考费率列表](https://raw.githubusercontent.com/gosomea/dsh-opencode-go/main/docs/media/settings-go.png)

![模型详情浮层](https://raw.githubusercontent.com/gosomea/dsh-opencode-go/main/docs/media/model-details.png)

![对话模型选择](https://raw.githubusercontent.com/gosomea/dsh-opencode-go/main/docs/media/model-picker.png)

## Model Experience

### OpenCode 推理

#### What the model sees

模型接收 DSH pi-ai 原有转换后的系统提示、会话消息、工具和已准入图片。插件不增加提示词、工具或隐藏指令；Session ID 位于 HTTP header，费率是用户界面元数据。

#### Token effect

没有新增 prompt token。目录刷新是普通 HTTP 请求，不调用推理；实际 token 计费由供应商决定。

#### KV Cache effect

同一 Session 的 header 保持稳定，可能帮助上游亲和性，但不保证缓存命中。切换模型、协议或显式能力设置可能改变请求转换和前缀缓存复用。

## 验证、限制与回滚

`npm test` 覆盖发现、价格、真实 HTTP 头、协议、缓存失败/取消和真实文件 Loader 加载及卸载；`npm run pack:check` 检查分发内容。[验收记录](docs/verification.md)区分真实 Host 与离线测试。目录可见不等于账户有调用权限。

官方 HTML 表结构变化会让刷新报错并保留缓存。暂不查询账户余额、不提供 OAuth、不购买额度；仅声明 DSH 支持的 text/image 输入。Jev `/systemone` 是决策接口，保留诊断而不安装为聊天模型。

**Runtime invariant：**没有独立 companion。模型、HTTP 和 UI 都从同一个已提交目录快照派生，没有独立事件投影可以比较；通过校验、原子更新和卸载测试保证行为。

[随包 Skill](skills/dsh-opencode-go/SKILL.md)可软链接到 `$DSH_HOME/skills/dsh-opencode-go`，先核对已有目标。回滚时在 Host 空闲后恢复迁移保存的 `cordis.patch.yml`，再执行 `dsh plugin --profile web remove @foreveryu/dsh-opencode-go`；若此后修改过其他配置，应合并恢复，不能覆盖。公共缓存可独立保留或删除。
