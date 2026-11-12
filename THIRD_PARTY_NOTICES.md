# 第三方组件与许可 · Third-party notices

Tideline 的发布文件（`main.js`、`styles.css`）里包含以下第三方作品。许可原文在 [licenses/](licenses/) 文件夹，构建也把相应许可附入独立的 JS 和 CSS 发布文件。

| 组件 | 用在哪里 | 许可 | 原文 |
| --- | --- | --- | --- |
| [perfect-freehand](https://github.com/steveruizok/perfect-freehand) 1.2.2，© 2021 Stephen Ruiz Ltd | 所有手绘笔压线条（打包进 `main.js`） | MIT | [licenses/perfect-freehand.txt](licenses/perfect-freehand.txt) |
| [marked](https://github.com/markedjs/marked) 17.0.5，© 2018–2026 MarkedJS，© 2011–2018 Christopher Jeffrey | 指引页渲染 AI 回复的 Markdown（`src/draw/proto/vendor/marked.mjs`，打包进 `main.js`） | MIT | [licenses/marked.txt](licenses/marked.txt) |
| [IBM Plex Mono](https://github.com/IBM/plex) Light，© 2017 IBM Corp.，保留字体名 “Plex” | 时刻与数字的等宽字（内嵌在 `styles.css`） | SIL Open Font License 1.1 | [licenses/IBM-Plex-Mono.txt](licenses/IBM-Plex-Mono.txt) |
| [Noto Sans SC](https://github.com/notofonts/noto-cjk)（思源黑体）Light | 手写字：界面里少量汉字的笔画骨架由这款字体的字形细化得到，再用自绘笔压线重描（`src/draw/proto/paper-handfont-r28.js`）。不包含字体文件本身 | SIL Open Font License 1.1 | [licenses/Noto-Sans-CJK.txt](licenses/Noto-Sans-CJK.txt) |

插件界面里的插画（货舱、灯塔、海图、船、天空等）由作者绘制或用本地 perfect-freehand 生成，属于本项目。

构建用的 [esbuild](https://github.com/evanw/esbuild)（MIT）只在开发时使用，不进入发布文件。
