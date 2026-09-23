# System Blueprint v2

把代码仓库、设计文档或系统描述转成可阅读、可交互、可离线分享的技术图。默认浅色工程风，使用文字、形状、方向和克制的强调色表达关系。

交付包含可继续修改的 `.diagram.json`、双击即可打开的单文件 HTML，以及按需导出的 SVG、PNG、JPEG。HTML 支持缩放、平移、节点与关系详情、上下游高亮、两层分组折叠；不需要账号、服务器或网络连接。

[项目仓库](https://github.com/JX05120LLL/system-blueprint) · [Skill 入口](system-blueprint/SKILL.md) · [模型规则](system-blueprint/references/modeling.md) · [验证记录](docs/validation/)

## 快速开始

生成者需要 **Node.js 24.x**。在仓库根目录运行：

```powershell
node system-blueprint/scripts/validate.mjs examples/overview.diagram.json
node system-blueprint/scripts/generate.mjs examples/overview.diagram.json --output output/overview.html
```

用浏览器打开 `output/overview.html`。生成不需要 npm install、Playwright 或仓库根目录的开发依赖：已构建的运行时随 Skill 分发。HTML 已组装仍需实际打开，检查文字、关系、交互和导出效果。

需要自动导出时再安装 Skill 内的依赖：

```powershell
npm ci --prefix system-blueprint
node system-blueprint/node_modules/playwright/cli.js install chromium

node system-blueprint/scripts/export.mjs output/overview.html --format svg --output output/overview.svg
node system-blueprint/scripts/export.mjs output/overview.html --format png --scale 2 --output output/overview.png
node system-blueprint/scripts/export.mjs output/overview.html --format jpg --background "#FFFFFF" --output output/overview.jpg
```

浏览器工具栏也可直接下载 SVG。PNG/JPEG 使用 CLI 的 Chromium 渲染；HTML 阅读者无需安装 Node 或 Playwright。

## 五类示例

README 中显示的是静态 SVG。交互请下载相应 HTML 后在浏览器打开；每份 HTML 独立、自包含，不依赖同目录文件。

[全部 JSON / HTML / SVG / PNG / JPEG 产物](examples/README.md) · [新旧效果对照与截图](artifacts/visual-comparison.html)

| 类型 | 源数据 | 交互阅读器 |
| --- | --- | --- |
| System Overview | [overview.diagram.json](examples/overview.diagram.json) | [overview.html](examples/overview.html) |
| Runtime Flow | [runtime-flow.diagram.json](examples/runtime-flow.diagram.json) | [runtime-flow.html](examples/runtime-flow.html) |
| Memory / Recall | [memory-recall.diagram.json](examples/memory-recall.diagram.json) | [memory-recall.html](examples/memory-recall.html) |
| Deployment Topology | [deployment-topology.diagram.json](examples/deployment-topology.diagram.json) | [deployment-topology.html](examples/deployment-topology.html) |
| Before / After | [before.diagram.json](examples/before.diagram.json)、[after.diagram.json](examples/after.diagram.json) | [before.html](examples/before.html)、[after.html](examples/after.html) |

### System Overview

![System Blueprint 总览图](./images/system-blueprint-overview.svg)

### Runtime Flow

![Runtime Flow 运行流程图](./images/system-blueprint-runtime-flow.svg)

### Memory / Recall

![Memory / Recall 流程图](./images/system-blueprint-memory-recall.svg)

### Deployment Topology

![Deployment Topology 拓扑图](./images/system-blueprint-deployment-topology.svg)

### Before / After

![Before / After 蓝图对比图](./images/system-blueprint-before-after.svg)

Before/After 使用相同前端、API、数据库基线与主题；新增 LLM 能力明确标为规划。两份单图保持相同比例合成静态对比图，交互仍分别打开两份 HTML。迁移的保留项、简化项和假设见 [示例迁移说明](docs/validation/example-migration.md)。

## 安装为 Skill

将整个 `system-blueprint/` 复制到 Codex 的 Skills 目录，例如：

```text
~/.codex/skills/system-blueprint/
├── SKILL.md
├── agents/
├── references/
├── assets/
├── scripts/
├── package.json
└── package-lock.json
```

复制的是子目录，不是整个仓库。保留所有这些资源及许可文件，不能只复制 SKILL.md。生成与阅读不需要源码或根目录 node_modules；安装到其他位置后，命令从脚本自身位置解析随包资源。使用绝对输入/输出路径可避免工作目录歧义。

如需要自动导出，在**复制后的 Skill 目录**执行 `npm ci`，再运行 `node node_modules/playwright/cli.js install chromium`。仅传阅生成好的 HTML/SVG 时无需安装任何依赖。

也可以将这个完整子目录打包分发，或用于支持类似 SKILL.md 约定的其他 Agent；不同平台的触发元数据仍需自行核对。

## 给 Agent 的请求示例

```text
使用 system-blueprint，为这个仓库生成系统总览。
先核对实际模块与调用关系，区分已证实、假设和规划。
输出可修改的图数据、离线交互 HTML，以及 README 可嵌入的 SVG。
采用默认浅色工程风，保留关键条件、回路、边界和来源。
请实际打开验证，并说明未验证的部分。
```

```text
使用 system-blueprint，绘制请求处理或 Memory/Recall 流程。
必须能看清需要检索、不检索、未命中和失败路径。
长说明放详情，关键条件保留在图上；不要用缩小字号解决溢出。
```

用户明确要求 Mermaid 时尊重该格式。此工具不提供在线协作、账号服务、拖拽改图或图形编辑器；增量修改优先编辑原 JSON 并保留 ID。

## 模型与交互约定

图类型为 overview、flow、deployment；Memory 使用 flow；比较图使用两份独立文档。模型使用 JSON Schema / Ajv 结构校验，并另行检查引用、条件、方向、分组和主路径。详见 [建模规则与最小示例](system-blueprint/references/modeling.md)。

- 首版上限：100 节点、300 边、20 组、最多两层分组；文件不超过 2 MiB，单个 details 不超过 8,000 字符。超限明确报错并建议总览加子图，不截断数据。
- decision 至少两个带有不同非空条件的流程出口；control/exception/feedback 必须有向。普通回路、自环合法；data/dependency 不算判断分支。
- 先用本机字体测量，再用 ELK 布局。节点标题与 summary 最多两行，边标签最多三行；超出时给出字段诊断，精简内容或拆图，不自动缩小或截断。
- flow 上下游只沿流程边遍历；overview/deployment 遍历所有有向关系。无向依赖只显示直接关联。
- 折叠不会修改原模型。隐藏判断与条件有摘要提示，组和聚合边详情可追溯原始内容；展开父组会恢复子组的折叠选择。
- Tab、Enter、Space 和 Escape 支持基本阅读操作。窄屏保留平移和可关闭详情；工具栏不会要求整图压缩到看不清。
- 长图首次打开采用 80% 的可读起点视角。主动“适应画布”或“重置视图”显示完整图，必要时低于 25%；继续放大保持倍率连续。重置恢复初始折叠并清除选择，但保留主题。

HTML 内嵌的 details 也是分享内容；折叠不能脱敏。不要将密码、令牌、真实用户记录或整份私有配置放入模型。文本会转义并以文字渲染，不接受可执行 HTML。

## 导出与命令边界

静态导出使用独立全展开视图，包含标题、说明、标签、箭头、背景和必要图例；不包含工具栏、详情面板或当前高亮。缩放、平移、折叠不会裁切导出内容，也不会因导出而改变阅读器状态。

```powershell
# 新命令默认不覆盖；确认替换时显式添加 --overwrite
node system-blueprint/scripts/generate.mjs examples/overview.diagram.json --output output/overview.html --overwrite
node system-blueprint/scripts/export.mjs output/overview.html --format svg --theme dark --output output/overview-dark.svg
node system-blueprint/scripts/export.mjs --help
```

路径支持空格和中文，输出目录按需创建。输入/参数错误退出 2，依赖、浏览器或渲染失败退出 1，成功退出 0。输出扩展名与真实格式必须一致，冲突会报错。

SVG 是矢量格式，不接受 scale。PNG/JPEG 默认 scale=2，允许 0.5–4；任何边超过 16,000 px 或总像素超过 40,000,000 时停止，要求降低倍率或拆图，不悄悄裁切。JPEG 使用明确背景，例如 `#FFFFFF`。系统字体在不同平台可能不同，需要固定像素外观时提供位图。

## 旧 HTML / SVG 与 Python 入口

旧静态 HTML/SVG 仍能直接使用，原模板保留在 [legacy-template.html](system-blueprint/assets/legacy-template.html)。v1 文件没有完整模型，迁移按语义人工重建，不承诺自动无损还原。v2 HTML 的原数据位于 `script#blueprint-data`，也建议始终保留独立 JSON。

```powershell
# 旧 SVG 位图导出
pip install cairosvg pillow
python system-blueprint/scripts/export_diagram.py old-diagram.svg --format png --output output/legacy.png

# 旧 HTML 与 v2 HTML 都转交 Node / Playwright
python system-blueprint/scripts/export_diagram.py old-diagram.html --format jpg --background "#FFFFFF"

# 旧 HTML 含多个 SVG 时明确选择，从 0 开始
python system-blueprint/scripts/export_diagram.py multi.html --format png --svg-index 1
```

| 输入 / 入口 | 范围与依赖 |
| --- | --- |
| v2 HTML → Node export.mjs | SVG / PNG / JPEG；Skill 内 Playwright + Chromium |
| v1 HTML → Node 或 Python | 仅 PNG / JPEG；静态自包含内联 SVG；不执行页面脚本，阻止远程资源；多图必须给索引 |
| SVG → Python | PNG / JPEG；CairoSVG + Pillow；Windows 可能另需 Cairo 运行库 |
| v1 HTML → 独立 SVG | 不在兼容范围；需要 v2 模型重新生成 |

Python 兼容入口保留原来的**覆盖已有输出**行为和默认 `#08111E` 背景参数；新 Node 命令必须 `--overwrite`。旧 HTML 导出现在新增 Node/Playwright 依赖，不再依赖 BeautifulSoup 提取 SVG，也不再把浏览器 CSS 当成 CairoSVG 可完整复现的能力。旧 SVG 路径仍受 CairoSVG 支持范围限制，不能保证全部浏览器滤镜一致。

## 维护与验证

源码按 model / projection / layout / render / viewer / export / cli 分层；schema 生成 TypeScript 类型与独立校验器；esbuild 生成随 Skill 分发的 JS。ELK 布局 Worker 的源码内嵌到 HTML，再创建 Blob Worker，不需要相邻 Worker 文件。

```powershell
npm ci
npm ci --prefix system-blueprint
node system-blueprint/node_modules/playwright/cli.js install chromium
npm run check:build
npm run typecheck
npm run test:unit
npm run build
npm run check:build
npm run test:browser
npm run test:package
npm run examples:check

# 重生成示例、测量性能
npm run examples:generate
npm run test:performance
```

Windows PowerShell 如果拦截 npm.ps1，可使用 `npm.cmd`。Linux CI 安装 Chromium 时还需准备系统依赖。修改源码后必须重新 build，避免预构建资源与源码脱节。

`check:build` 在临时目录从源码重建，比对 20 个分发/生成文件、许可证、版本和 lockfile；不会先覆盖原产物来掩盖不一致。完整 skill 的本地安装包为 [system-blueprint-v2.zip](artifacts/system-blueprint-v2.zip)，不包含 node_modules。

[完整验收结果](docs/validation/v2-validation-report.md) · [性能实测](docs/validation/performance.md) · [22 项验收计划](docs/validation/acceptance-plan.md) · [浏览器实测](docs/validation/browser-coverage.md) · [测试数据语义](docs/validation/fixture-report.md) · [布局检查](docs/validation/layout-report.md) · [示例迁移](docs/validation/example-migration.md)

性能目标与已测结果分开：30 节点 / 45 边 / 3 组的 HTML 目标不超过 3 MiB，首次就绪 p95 ≤1.5 秒，折叠/展开 p95 ≤500 毫秒；100 / 300 / 20 上沿要求完整完成并记录耗时和主线程阻塞。这些是方案目标，不能从构建通过或简单图推断全部达标；实际机器、浏览器、样本、时间和体积见 [性能实测记录](docs/validation/performance.md)。

自动布局不能保证任意复杂图零交叉。结构校验、几何检查与实际截图审查缺一不可；本机 Chromium 验证也不等于所有操作系统、浏览器或真实部署均已验证。浏览器不可用时可以先交付经过校验的数据和已组装 HTML，但必须明确视觉、交互或导出未验证。
