# 当前宿主部署

[部署收据](alpha-compat-deployment.json)记录最终包摘要、已安装文件核对与当前宿主身份。0.1.2 已安装到 web profile，并与 Supervisor 0.1.6 一起通过 dsh-web 在 3080 重启。

20 个针对性测试、严格检查、构建与包检查通过。CodeBuddy 与 OpenCode Go 的真实 deepseek-v4.1-flash 请求均完成。日常运行实例目录刷新无错误：记录时点包含 86 个 Zen 模型与 37 个 Go 模型。可用性取决于账号与上游当前目录。

验证在独立测试 home 中复用依赖缓存及既有构建批准，未证明全新 registry／store 安装。最终包与模型测试候选的差异仅为说明文字，运行代码字节已比较。本次未执行 npm 发布。凭据与原有日常 Session 目录保留。
