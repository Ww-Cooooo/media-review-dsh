# 插件发布与作者支持计划

核查日期：2026-11-11。本项目由社区独立开发维护，非 DeepSeek 官方插件。

## 目前怎样发布 DSH 插件

官方采用带 `dsh.bundle` 声明及配置 patch 的组合包。分发可以使用 npm、Git 仓库或预构建 tgz，**没有必须放在 GitHub 开源的统一要求**。Media Review DSH 使用独立 GitHub 仓库和 Release，主要安装入口是经过实测的 tgz；源码、使用说明和许可一并公开。[已读原文：[官方打包与安装文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.zh.md)]

本项目的发布材料包括源码、`lib/` 构建产物、官方组合包清单、tgz、使用说明、校验值、许可及实测摘要。发布版本为 `v0.1.0-rc.6`，仍标记为预发布版；实测兼容范围是 Windows / DeepSeek Harness 0.2.2-rc.1。桌面安装步骤见 [INSTALL.md](INSTALL.md)。

官网的“社区插件”入口指向 GitHub 的 `dsh-plugin` 话题。仓库添加该话题可用于社区发现；这不等于进入官方审核名单。[已读原文：[DSH 官网](https://www.deepseek.com/zh/harness/)]

当前的“自定义插件索引”需要用户自行添加索引源。索引可列出 npm 或锁定提交的 Git 来源；发布者编写索引并放到静态主机，并不等于官方市场收录。本次没有发布 npm 包或另设索引源。[已读原文：[官方插件索引说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/plugin-market.zh.md)]

## Token 活动的准确状态

11 月 5 日，DeepSeek Harness 团队发布《DeepSeek Harness 与插件社区共同成长》，介绍正在筹备的插件作者支持计划，支持方向包括 Token、技术交流和作品推荐。**目前开放的是前期意向登记；具体参与规则和支持安排尚待正式公布。**[已读原文：[官方公告](https://mp.weixin.qq.com/s/xqyrRaiBpIcf0jeJzP7W0g)]

官方公告“阅读原文”链接到 [插件作者／合作意向登记表](https://trtgsjkv6r.feishu.cn/share/base/form/shrcnkRrxNyri4bOF9n48BIYWbb)。查看表单无需登录；本次只核对了字段，没有提交。[已读原文]

## 报名要填什么

下表按当前官方表单的顺序整理：[已读原文：[登记表](https://trtgsjkv6r.feishu.cn/share/base/form/shrcnkRrxNyri4bOF9n48BIYWbb)]

| 字段 | 是否必填 | Media Review DSH 的准备情况 |
| --- | --- | --- |
| 姓名／昵称 | 必填 | 由作者决定希望使用的称呼。 |
| 邮箱 | 必填 | 由作者提供用于后续联系的邮箱。 |
| 你的身份 | 必填，单选 | 个人作者／创业公司或独立团队／企业团队／其他，由作者选择。 |
| 团队／公司信息 | 选填 | 可填写名称及网站；个人作者可留空。 |
| 插件名称／想法名称 | 必填 | Media Review DSH。 |
| 当前阶段 | 必填，单选 | GitHub 发布后可选择“已发布并持续维护”。 |
| 插件／想法简介 | 必填 | 说明目标用户、解决的问题、主要功能与已有成果；下方提供本项目内容。 |
| 作品链接 | 选填 | 可填本项目 GitHub 仓库与 Release。官方也接受主页、演示视频或体验链接。 |
| 希望获得的支持或探索的合作 | 必填，多选 | Token 支持等，按作者实际意向选择。 |
| 其他想说的 | 选填 | 困难、后续计划或支持需求。 |

“当前阶段”完整选项为：已有想法，尚未开始；正在开发；已有可体验版本；已发布并持续维护。

“希望获得的支持或探索的合作”完整选项为：Token 支持；技术交流与开发答疑；作品推荐与曝光；用户反馈与产品打磨；通过 DSH 插件市场提供产品或服务；探索其他合作，想先与团队交流；其他（可在下一题补充）。

作品部分可使用以下内容，个人信息与合作选择由作者自己填写：

> Media Review DSH 是 DeepSeek Harness 的原生音视频审片插件，面向使用 Agent 制作或修改音视频的创作者。用户可在波形上拖选时间段，或暂停后在画面上直接框选并写意见；支持滚轮缩放、声音 A/B 对照、台词定位、草稿恢复和离线导出。插件把固定的一轮意见交给所选制作会话，待实际新版登记回来后，用户按意见比较并逐条确认。当前已提供 Windows / DeepSeek Harness 0.2.2-rc.1 的安装包，在真实本地客户端完成两轮模型返修和逐项功能验证；具体方法和限制在仓库验证文档中公开。项目与原 Media Review Skill 独立维护。

作品链接：

- 仓库：https://github.com/Ww-Cooooo/media-review-dsh
- 安装包与说明：https://github.com/Ww-Cooooo/media-review-dsh/releases/tag/v0.1.0-rc.6
- 实测结果：https://github.com/Ww-Cooooo/media-review-dsh/blob/main/FINAL-VERIFICATION.md

提交时打开官方表单，填写必填项、核对作品链接与联系邮箱，再点提交并保留实际成功回执。发布 GitHub 不会自动提交这张表。

截至核查日，公告和表单未提供截止日期、奖励额度与发放方式、评选时间、名额、评分规则、最低 Star／用户量门槛，也没有要求必须开源、必须 npm、必须进入索引或必须有演示视频。后续若发布正式规则，应重新核对；登记不代表入选、获推荐或已经获得 Token。[未取得：正式支持规则]

## 社区展示是另外一步

官方仓库插件专区的展示规则要求一个项目一篇讨论，标题包含 DSH、项目名和用途，正文包含项目链接、短简介、真实集成方式及截图、GIF 或视频，并显著说明为社区独立维护。社区投票不代表官方审核或推荐。[已读原文：[官方专区规则](https://github.com/deepseek-ai/deepseek-harness/discussions/2004)]

GitHub Release、社区展示帖、作者意向登记分别办理。仓库与安装包已公开；2026 年 11 月 11 日已在官方 Show Your Plugins! 专区发布 [Media Review DSH 展示帖](https://github.com/deepseek-ai/deepseek-harness/discussions/12926)，包含插件介绍、安装步骤、三张实际截图与验证说明，并已确认帖子可公开访问、图片正常加载。作者意向登记由作者另行填写，本项目未代交。专区发帖不代表官方审核、推荐或市场收录。
