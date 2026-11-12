# Media Review DSH · 侧栏版实拍

**Media Review DSH 是基于 [Media Review Skill](https://github.com/Ww-Cooooo/media-review) 改造的 DeepSeek Harness 原生插件。** 如果想在其他 Agent 中使用，可前往[原版 Skill 的 GitHub 仓库](https://github.com/Ww-Cooooo/media-review)下载和安装（Windows，需支持本机文件访问与命令执行）。

Media Review 专门解决用 AI 做视频时改稿反馈麻烦的痛点。AI 生成或剪完视频并送审后，会自动展开审阅侧栏。像用剪映一样拖时间轴、选画面，直接留下修改意见，核心有三大实用功能：

1. **直接框选画面改：** 不满意哪个区域直接在画面上圈出来，对着区域提修改要求，不用费劲描述“画面左上角、人物右侧”这类位置信息。
2. **时间定位灵活选：** 既能选中一整段时间段落批量提问题，也能精准定格到某一个时间点单独调整，整段修改和细节修正都能满足。
3. **字幕点击秒跳转：** 识别视频中的语音台词，或导入已有字幕；点哪句就直接跳到对应的画面，长视频找内容特别快。

同一段有对白、停顿和中文字幕的影片，边看边留下修改意见。以下截图来自已安装的 **0.1.0-rc.8**，在 Windows / DeepSeek Harness 0.2.2-rc.1 独立环境中实际操作后，按入口或侧栏区域截取。

## 收起之后，从输入框上方重新打开

当前对话有送审记录时，**打开审片台**固定在输入框上方。作品送来时自动展开；点审片台右上角的 **×** 收起，再点这个按钮就能找回。

![当前对话输入框上方的打开审片台按钮](assets/screenshots/sidebar-entry.png)

## 停在一帧，直接框住要改的地方

审片台在右侧展开。暂停影片、框住字幕，直接写“这句字幕离底边太近，整体上移一点，保持现在的字号”。宽侧栏中，视频和意见并排。

![右侧审片台中的视频、字幕框选与直接编辑的意见](assets/screenshots/frame-annotations.png)

## 拖选对白，滚轮放大检查

拖选 **00:06–00:08.5**，给“我在寻找一个人”这句对白写声音意见。鼠标滚轮放大时间轴，波形仍保持 **92 px**，显示实际音轨的强弱起伏。

![右侧审片台中选中一句对白并放大波形时间轴](assets/screenshots/waveform-range.png)

## 拖窄侧栏，内容自动上下排列

拖动左边缘调宽。窄时视频与意见上下排列，当前意见、播放位置和框选继续保留。

![拖窄后的侧栏，视频、紧凑波形与意见上下排列](assets/screenshots/sidebar-narrow.png)

素材来自《Sintel》，© Blender Foundation · [原作](https://durian.blender.org/) · [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)。本地截取 28 秒对白并添加中文字幕，音轨未调整音量；[素材与改动说明](assets/screenshots/ATTRIBUTION.md)。示例意见用于展示标注操作，未调用模型返修这次演示。

[本次实拍检查](verification/showcase-rc8-check.json) · [本地客户端实测](FINAL-VERIFICATION.md) · [安装和使用](INSTALL.md)
