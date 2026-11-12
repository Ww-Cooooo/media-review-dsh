# 安装详情

**Media Review DSH 是基于 [Media Review Skill](https://github.com/Ww-Cooooo/media-review) 改造的 DeepSeek Harness 原生插件。** 如果想在其他 Agent 中使用，可前往[原版 Skill 的 GitHub 仓库](https://github.com/Ww-Cooooo/media-review)下载和安装（Windows，需支持本机文件访问与命令执行）。

## 在桌面客户端安装

本版为 **Media Review DSH 0.1.0-rc.8**，已验证 **Windows / DeepSeek Harness 0.2.2-rc.1**。安装包声明了这个精确的 Harness 版本，其他版本可能被宿主拒绝；不要通过删除版本要求绕过检查。先在客户端的 **应用 → 关于 DeepSeek Harness** 查看当前版本。

1. 打开 [v0.1.0-rc.8 发布页](https://github.com/Ww-Cooooo/media-review-dsh/releases/tag/v0.1.0-rc.8)，在 **Assets** 下载 `media-review-dsh-0.1.0-rc.8.tgz`。下载 `delivery.zip` 也可以，解压 ZIP 后取出同名 tgz。GitHub 自动生成的 Source code ZIP／tar.gz 是源码，不是这个安装包。
2. 保留 tgz 文件，不解压。复制它在本机的完整路径，例如 `C:/Downloads/media-review-dsh-0.1.0-rc.8.tgz`。将例子替换成实际路径；粘贴到客户端时不加外层引号。
3. 在 Harness 侧栏打开 **插件**，点 **添加插件**。如果展开的是旁边箭头菜单，选择 **安装第三方插件**。
4. 把完整路径粘贴进包名输入框，点 **安装**。Host 会读取包信息并安装依赖；本地 tgz 安装仍可能联网获取所需依赖。
5. 安装结果应显示包名 `media-review-dsh` 和版本 `0.1.0-rc.8`。点 **立即启用**；直接关闭安装结果可能会让它保持已安装但未启用。
6. 如果宿主要求重启，先保存正在进行的工作，从 **应用 → 退出** 完整退出后重新打开。只关窗口可能仍在后台运行。
7. 回到 **插件 → 已安装插件**，确认 **Media Review DSH** 已开启。选定制作会话，从 **更多会话视图（…）→ 新建审片** 打开；已有送审记录的会话，输入框上方会显示 **打开审片台**。右侧审片台实际加载后才算入口可用。

本插件通过 Harness 自带运行环境安装，普通桌面用户不用额外安装 Node、npm 或原 Media Review Skill。模型沿用所选制作会话的配置；安装插件不需要重新配置现有模型。

官方依据（2026-11-11 已读原文）：[插件页安装与启用](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-plugin-manager/README.zh.md#安装一个组合包)、[组合包打包与安装](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.zh.md)、[桌面应用说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/desktop/README.zh.md)。本项目的实际安装记录见 [最终验证](FINAL-VERIFICATION.md)。

## 第一次记一条意见

在 Harness 创建或选定工作区，把音视频放在工作区目录内。选定制作会话，让它将文件登记送审，审片台会从右侧自动展开。也可从会话顶部 **更多会话视图（…）→ 新建审片** 手动选文件；只做人工审片时可不绑定制作会话。空白会话先发送一条消息，再使用顶部菜单。

收起后，点输入框上方固定的 **打开审片台** 恢复。拖动侧栏左边缘调宽：宽时视频和意见并排，窄时上下排列；聊天输入仍可使用。

播放后，直接在波形上拖出一段时间，松开就能写意见；或者暂停，在画面上拖框后写意见。点 **保存** 并看到成功结果。需要交给模型返修时点 **发送修改意见**，核对目标会话和允许改动范围；收到新版后在 **查看修改结果** 中逐条判断。

波形、缩略图与自动台词需要下面的本机工具。可以先用已有字幕和手动标注；缺少媒体识别工具时，新建审片里的 **媒体工具不可用？** 可手选同一份文件核对，512 MB 以内可先人工审片。

## 安装失败或找不到入口

| 看到的情况 | 下一步 |
| --- | --- |
| 已经安装同名插件 | 按下文“配置和更新”备份记录，再卸载旧包、安装新 tgz；不要同时装两个开发副本。 |
| 版本不兼容 | 核对 Harness 版本与 `0.2.2-rc.1`，保留完整错误信息；本版不承诺其他版本兼容。 |
| 找不到审片入口 | 确认插件已启用；手动新建在会话顶部“更多会话视图（…）”。当前会话有送审记录后，输入框上方才显示“打开审片台”。按宿主提示完整重启，再核对运行状态。 |
| 路径不存在／没有组合包 | 确认选的是 `.tgz` 本体和实际完整路径；不要填 `delivery.zip`、源码 ZIP 或解压后的 Skill 目录。 |
| 依赖下载失败 | 展开“查看安装详情”；依赖注册表失败时可按宿主提示换安装源。本插件 tgz 已本地下载时，不需要再次从 GitHub 拉取它。 |
| GitHub 下载失败 | 安装源镜像不能代替 GitHub 资产下载。先取得完整 tgz，再用本地路径安装并核对校验值。 |

需要校验下载时，可在 PowerShell 7 执行 `Get-FileHash -Algorithm SHA256 '实际路径.tgz'`，对照发布页 `SHA256SUMS.txt`。不要把模型密钥、带登录参数的本机地址或私人审片日志贴到公开问题区。

## 准备媒体识别工具

先在 **设置与存储 → 检查并补齐缺失项** 检查。已有可用 FFmpeg、Whisper 和模型会复用；只有缺失或失效项才下载。固定版本文件经大小和 SHA-256 核验后解压，再用随包的短中文语音实测；第二次检查会复用未变化且已通过的结果。下载保存在本插件数据目录下的 runtime 中，不写入原 Skill，也不改动模型会话配置。

全部缺失约需下载 580 MB，可随时停止。网络不可达时保留人工播放、标注与字幕导入。展开“指定已有工具与模型”可填入已有工具；明确指定的失效路径会提示修正，不会擅自替换。也可以手动准备 FFmpeg：

1. 打开 [FFmpeg 官方下载页](https://ffmpeg.org/download.html) 的 **Windows EXE Files**，进入其链接的 [gyan.dev 构建页](https://www.gyan.dev/ffmpeg/builds/)。
2. 在 **release builds** 下载 `ffmpeg-release-essentials.zip`，解压到一个固定目录。该 Windows 发行包包含 `ffprobe`；不必把它放进插件目录，也不必修改系统 PATH。
3. 在解压文件夹内找到 `bin/ffprobe.exe`，将这个文件的完整路径填入审片台 **设置与存储 → 媒体识别工具**，点 **保存设置**。之后回到 **新建审片** 选择媒体。

这是外部媒体工具，未包含在插件安装包中；其许可随下载包提供。

## 播放兼容处理

视频可转为 MP4 容器、H.264 视频和 AAC 音频。用 PowerShell 7 执行下面的示例，三个路径都换成实际路径，输出文件放在当前工作区内。`-n` 会拒绝覆盖已有文件：

```powershell
& 'C:/Tools/ffmpeg/bin/ffmpeg.exe' -n -i 'C:/MyWorkspace/input.mov' -c:v libx264 -pix_fmt yuv420p -c:a aac 'C:/MyWorkspace/compatible.mp4'
```

然后从 **新建审片** 登记新文件；原文件保留。纯音频可另存为 AAC 编码的 M4A：

```powershell
& 'C:/Tools/ffmpeg/bin/ffmpeg.exe' -n -i 'C:/MyWorkspace/input.wav' -vn -c:a aac 'C:/MyWorkspace/compatible.m4a'
```

## 独立命令行测试环境

这条路线面向愿意使用命令行的用户，普通桌面安装不需要它。若还没有 `dsh` 命令，先安装 [Node.js](https://nodejs.org/en/download) 24.9 以上，再在 PowerShell 7 中安装这里匹配的官方 CLI：

```powershell
npm install --global @deepseek-ai/dsh@0.2.2-rc.1
dsh --version
```

若已安装其他版本的全局 `dsh`，不要覆盖它，可把下方每条 `dsh` 命令的开头替换成 `npx --yes @deepseek-ai/dsh@0.2.2-rc.1`，其余参数不变。首次执行可能下载对应运行依赖。CLI 包版本与 Node 要求已核对官方 npm 元数据；命令入口见 [官方启动说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/README.zh.md)。

选一个**尚未使用**的数据目录与配置名称；下面分别使用 `C:/DSH-test-data/media-review` 和 `media-review-dsh-test`。这是单独的环境，不接续桌面的工作区、会话或审片记录，也不会自动导入桌面的模型配置。

第一次创建环境时，先从官方 Web 模板初始化。下例的数据目录必须尚未使用，tgz 路径也须替换为实际完整路径；仅在新环境执行初始化命令，避免重置已有配置：

```powershell
$env:DSH_HOME='C:/DSH-test-data/media-review'
dsh --profile media-review-dsh-test --from-default-profile web --dump-config
dsh plugin --profile media-review-dsh-test add 'C:/Downloads/media-review-dsh-0.1.0-rc.8.tgz'
dsh --profile media-review-dsh-test --host 127.0.0.1 --port 21047 --no-open
```

在浏览器打开最后一条命令输出的本机连接地址；它包含临时登录信息，请不要分享。启动命令需保持运行。安装与启动是两个步骤，打开另一个测试服务不会切换已经运行的桌面客户端。

独立环境中需重新建立工作区、配置模型连接并登记媒体；原桌面记录保持在原数据目录。结束后关闭这个 PowerShell 窗口即可，不要把这里的 `DSH_HOME` 设置成系统全局变量。若要直接使用已配置好的桌面会话，请回到桌面客户端安装，不必新建测试环境。

## 桌面安装没有 dsh 命令

普通用户仍可直接在桌面界面安装。源码中的 `scripts/install-package.ps1` 可安装到已经建立的配置环境，仅安装插件，不启动服务，也不初始化 Web 模板。

若需使用脚本，先在 [源码仓库](https://github.com/Ww-Cooooo/media-review-dsh) 点 **Code → Download ZIP** 并解压，进入同时包含 `package.json` 和 `scripts/` 的目录。这里的源码 ZIP 仅用于取得脚本，安装对象仍是另行下载的 tgz。使用 PowerShell 7，并把示例路径替换为本机实际位置：

```powershell
pwsh -NoProfile -File ./scripts/install-package.ps1 -HarnessExe 'C:/Apps/DeepSeek Harness/DeepSeek Harness.exe' -HarnessHome 'C:/DSH-test-data/media-review' -Profile 'media-review-dsh-test' -Package 'C:/Downloads/media-review-dsh-0.1.0-rc.8.tgz'
```

`HarnessHome` 必须与创建该测试环境时使用的 `DSH_HOME` 一致。脚本调用桌面程序附带的官方安装器；桌面环境使用 `-Profile desktop` 并省略 `-HarnessHome`；若官方安装器要求退出客户端，先保存工作并完全退出，再重试。不要为桌面环境运行初始化模板命令。

## 桌面播放缓存

当前 Harness 桌面的媒体转发不保留文件长度，直接播放无法可靠跳转。本插件在客户端私有存储中分块建立临时磁盘副本，再交给原生播放器；原文件和审片记录不变，也不上传媒体。首次打开需等待准备完成，缓存总量最多 2 GiB，同时对照的两份作品合计也受此限制。超出时先关闭并排对照，单文件超出时，可按“独立命令行测试环境”建立 Web Client，再重新登记媒体；它不自动迁移原桌面的工作区、会话和记录。

离开审片面板会清理缓存；客户端意外退出留下的临时副本在下次打开面板时清理。每次重新打开缓存媒体仍经 Host 核验原文件可读且未变化。磁盘空间不足时保留意见并显示错误；释放空间后重新进入面板。此缓存不是审片资料备份。

## 配置和更新

在审片台顶部的 **设置与存储** 查看 `dataDirectory`，需要时填写已安装 `ffprobe` 的完整路径。媒体必须在所选工作区中，制作会话也必须属于该工作区。

更新前先保存意见并确认成功，再禁用插件并备份数据目录。按当前 Harness 插件页提示卸载旧版、安装新版；保留原数据目录，不要同时启用本插件的两个开发包。重新进入审片台后核对作品、意见和框选，再继续审片。

卸载插件保留数据；本插件没有清空任务库的按钮。恢复旧记录时，请把原媒体放回登记时的完整路径，并保留原内容。也可以从 **版本与轮次 → 原文件移动了？重新选择同版** 选择新路径；只有内容身份一致才保留原任务与意见。通过 **新建审片** 重新登记则会创建新作品。

审片记录还关联 Harness 的原工作区编号。仅复制插件数据目录不能重建工作区关系；删除后新建同名工作区也不会自动接回旧记录，当前没有更换工作区绑定的入口。请保留原 Harness 工作区记录。制作会话失效时，可在新提交中选择同一工作区的有效会话；已经固定的轮次仍保留原目标，不自动迁移。

若固定轮次尚未完成、制作会话却已失效，原轮次不能换目标重试。打开该轮意见后点 **查看原版草稿**，先核对草稿与旧轮次的差异，按需手动补回意见，再点 **发送修改意见** 并选择有效会话。这会建立新轮次；旧轮次保持原状态和记录，不会自动标成完成或取消。

## 分发方式

官方允许 npm、Git 仓库和本地 tgz 分发，**不要求必须放在 GitHub 开源**。目前的自定义插件索引支持 npm 和 Git 来源；官网社区入口使用 GitHub 的 `dsh-plugin` 话题，并不是官方审核上架证明。

参见 [官方打包说明](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/master/docs/user/develop/basic/publish.zh.md) 和 [官方索引说明](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/master/docs/user/guide/plugin-market.zh.md)。本项目使用独立的 [GitHub 仓库](https://github.com/Ww-Cooooo/media-review-dsh) 与 [Release](https://github.com/Ww-Cooooo/media-review-dsh/releases/tag/v0.1.0-rc.8) 分发预构建 tgz，未发布到 npm。仓库的 `dsh-plugin` 话题用于社区发现，不代表官方审核或活动入选。普通用户下载 tgz 后按客户端步骤安装；仓库附带构建产物，但本次安装验证以 Release 中的 tgz 为准。

## 本机波形与台词

波形右上方的 **波形缩放** 可等比例调整显示大小，不改变播放音量。放大时间轴查看局部时仍沿用整份作品的比例。持续、等音量的声音可能接近平直；波形显示实际变化，不人为制造起伏。

波形优先使用已配置 ffprobe 同目录的 ffmpeg，再使用原校对台登记的有效工具路径。识别台词优先复用原有 Whisper CPU 程序及模型；只在主动点击“检查并补齐缺失项”时补缺，不重复下载有效工具。超过 30 分钟的作品请导入 SRT／VTT。当前只分析第一条音轨；无音轨、工具不可用或识别失败时仍可播放和手动标注。分析可以停止；已有意见和已导入台词保留。
