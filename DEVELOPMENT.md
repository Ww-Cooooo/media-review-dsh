# 开发与测试

**Media Review DSH 是基于 [Media Review Skill](https://github.com/Ww-Cooooo/media-review) 改造的 DeepSeek Harness 原生插件。** 在其他 Agent 中审片，可[下载原版 Skill](https://github.com/Ww-Cooooo/media-review/releases/tag/v0.3.0-beta.11)（Windows，需支持本机文件访问与命令执行）。

源码对应 Media Review DSH 0.1.0-rc.8；支持 Windows、Node.js 24.9 以上、DeepSeek Harness 0.2.2-rc.1。普通用户直接按 [安装说明](INSTALL.md) 使用 Release 的 tgz。

## 构建

在源码根目录执行：

```text
npm ci --ignore-scripts
npm run typecheck
npm run build
node scripts/notices.mjs
npm pack --pack-destination dist
```

构建会生成 Host、React Client、官方 Remote 编解码器和本地字体资源。默认关闭开发预览。仓库保留与已验证安装包一致的 `lib/`，便于核对分发内容；自己构建的包需要在自己的独立 Harness 配置环境重新验证。

本次公开 tgz 保留本地 rc.8 已实测的运行文件与插件声明，只更新公开下载和使用说明。公开源码的构建与测试入口另保留可移植配置；从源码重新打包的整包校验值不要求与 Release 相同。对应关系见 verification/source-publication-check.json。

## 运行测试

先准备已有的 FFmpeg 与 ffprobe；测试会执行真实解码、波形分析和取帧。把二者所在目录加入当前终端 PATH，或在 PowerShell 7 中指定：

```powershell
$env:MR_TEST_FFMPEG='C:/Tools/ffmpeg/bin/ffmpeg.exe'
$env:MR_TEST_FFPROBE='C:/Tools/ffmpeg/bin/ffprobe.exe'
npm run test:fixtures
npm test
```

测试素材由脚本在 `fixtures/workspace/` 生成，是两个 40 秒纯色静音视频；已有同名文件不会被覆盖。测试记录写入仓库内的 `fixtures/contracts/`。这些目录不进入 Git 或安装包。

默认通过 29 项检查，跳过一项需要真实中文识别工具的检查。要运行全部 30 项，还需在同一终端指定本机 whisper.cpp CPU 程序和多语种模型，再执行 `npm test`：

```powershell
$env:MR_TEST_WHISPER='C:/Tools/whisper/whisper-cli.exe'
$env:MR_TEST_MODEL='C:/Tools/whisper/ggml-small.bin'
npm test
```

该项检查使用随源码附带的中文合成语音，确认已有工具可用、识别结果真实且再次准备时复用结果。测试不会下载工具，也不调用付费模型接口。完整模型返修与桌面交互属于另外的人工驱动实测，见 [最终验证](FINAL-VERIFICATION.md) 和 [逐项清单](FEATURE-VERIFICATION.md)。

## 目录

- `src/`：插件 Host、客户端、持久化和本机媒体分析。
- `lib/`：发布时的构建产物。
- `tests/`：业务约束、恢复、波形及工具检查。
- `verification/`：公开的验证摘要；不含模型凭据、私人运行日志或原媒体。
- `cordis.patch.yml`：官方组合包配置入口。

这是独立的 DSH 插件项目。复用的 Media Review 模块保留原许可，原 Skill 的任务库和运行入口不在此仓库内。
