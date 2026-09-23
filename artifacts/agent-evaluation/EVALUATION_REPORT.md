# System Blueprint 独立使用评估

本次从原始 SVG 独立完成了一张可交互、离线、自包含的浅色工程风 HTML，并交付可修改 JSON、完整 SVG 和 PNG。没有阅读当前仓库 src / tests / examples / 实施报告，也没有更改 Skill、提交或推送。

## 交付

- [交互 HTML](agent-runtime.html)：单文件，浏览器直接打开。支持缩放、拖动、详情、来源、上下游高亮、折叠、主题切换和 SVG 下载。
- [可修改图数据](agent-runtime.diagram.json)：13 节点、13 边、4 个单层阶段，使用稳定 ID，没有手写坐标。
- [独立 SVG](agent-runtime.svg)：494 × 2643，可无脚本打开。
- [PNG](agent-runtime.png)：988 × 5286，scale=2，真实 PNG 签名。
- [原始 SVG](原始运行流程.svg)：保留来源供核对。
- [验证记录](verification.json)、[浏览器验证脚本](verify-browser.mjs)、[建模脚本](build-model.mjs)。

## 输入、依据和语义决策

使用的 Skill 来自 `C:\Users\20526\AppData\Local\Temp\blueprint-evaluation-YFOqFz\system-blueprint`；原图来自同目录的 `原始运行流程.svg`。阅读文件限于 Skill 的 `SKILL.md`、`references/modeling.md`、`references/diagram-schema.json`、`references/visual-guidelines.md`、`package.json` 和原始 SVG。通过文档入口运行打包工具；没有查看当前仓库实现以倒推正确用法。

原图本身为 13 个节点、12 条无箭头连线和 4 个阶段，未提供真实代码或运行日志。

1. 保留原图四阶段、全部节点、章节次序与相邻连线；将短标签中文化，原英文节点名与说明完整放进 details，并添加原 SVG 的准确行号引用。
2. 原图的 `Scope Decision` 没有条件或分支出口，因此建模为范围选择过程，未为了 decision 校验编造分支。
3. `Output Mode` 的“HTML + SVG first, Mermaid only when explicitly needed”保留为可见摘要“默认 HTML + SVG；Mermaid 需明确请求”。原图未说明 Mermaid 的后续执行差异，因此没有发明跳过 SVG Rendering 的路径。
4. 原始连线没有箭头，重绘方向按阶段编号及从左至右阅读次序解释。12 条顺序边都标为 assumed，并在详情说明方向推定。
5. 原图有 `Feedback Loop` 和 `Iterated Output` 概念，却没有真正的回边。为表达迭代，增加“交付迭代结果 → 提取结构模型”的 feedback 边；可见标签是“再次修订（推定）”，状态 assumed，详情明确说明返回点与触发条件未经源码证实。这是本图唯一新增关系。
6. 节点的 confirmed 只表示“原图存在此概念”，每个 details 都明确不能据此证明已有运行时实现。分组表示工作阶段，不表示部署或权限隔离。

## 实际步骤和命令

本机工具版本：Node.js v24.14.0、npm 11.19.1、Playwright 1.58.2。工作在临时目录中新建的 output，完成后复制到仓库的 artifacts/agent-evaluation。

为便于阅读，下列变量分别对应当次真实路径；按顺序执行了建模、校验、生成、依赖准备、浏览器查看、静态导出和验收。

```powershell
$skill = 'C:\Users\20526\AppData\Local\Temp\blueprint-evaluation-YFOqFz\system-blueprint'
$work = 'C:\Users\20526\AppData\Local\Temp\blueprint-evaluation-YFOqFz\output'

node "$work\build-model.mjs"
node "$skill\scripts\validate.mjs" "$work\agent-runtime.diagram.json"
node "$skill\scripts\generate.mjs" "$work\agent-runtime.diagram.json" --output "$work\agent-runtime.html"

npm ci --prefix "$skill" # 本机 PATH 异常：未真正执行安装，见下文
npm.cmd ci --prefix "$skill"
node "$skill\node_modules\playwright\cli.js" install chromium

node "$work\inspect.mjs"
node "$work\inspect-details.mjs"
node "$skill\scripts\export.mjs" "$work\agent-runtime.html" --format svg --output "$work\agent-runtime.svg"
node "$skill\scripts\export.mjs" "$work\agent-runtime.html" --format png --scale 2 --output "$work\agent-runtime.png"
node "$work\verify-browser.mjs"
node "$work\verify-static.mjs"
```

校验输出 `valid: true, diagnostics: []`；生成输出 `assembled; browser validation required`，未将组装成功当成视觉验收。随后真实启动 Chromium，通过 file:// 打开文件，等待 `window.blueprint.ready`，每次交互等待 `whenIdle()`，没有用固定延时替代就绪。

导出的文件复制后，在最终交付目录又执行了一次浏览器检查。验证脚本使用同目录的 evaluation-env.mjs；更换电脑或 Skill 安装位置时设置：

```powershell
$env:SYSTEM_BLUEPRINT_SKILL_DIR = '你的 system-blueprint Skill 绝对路径'
node 'D:\code\system-blueprint-skill\artifacts\agent-evaluation\verify-browser.mjs'
```

编辑 JSON 后，用 generate 重新生成；目标文件已存在时按 Skill 要求添加 `--overwrite`。建模脚本可重新创建本例数据，日常修改直接编辑 JSON 即可。

## 实际验收结果

29 项检查通过，完整机读结果见 verification.json。

- 1366×768、1920×1080、375×812：画布与工具栏无页面横向溢出；窄屏详情可打开和关闭。
- 初始图 80% 显示，长图提示拖动阅读；适应画布后 1366 视口约 22%，继续放大连续。
- 使用实际 SVG getBBox / isPointInFill 与布局几何核对：13 节点互不重叠；全部文字在节点内；子节点在所属组内；13 条关系不穿过非端点节点；标签未被节点遮挡；箭头结束于目标边界。
- 节点详情保留原英文、条件与源文件行号；反馈边详情明确显示推定及来源。键盘 Enter 可打开，Escape 关闭并恢复焦点。
- 上游、下游高亮包含循环且不重复；缩放按钮、滚轮、平移有效，拖动未误选节点。
- 分组支持 Enter / Space；连续 10 次切换后最新 revision 与 committedRevision 一致。
- 折叠“编排与渲染”后，通过页面下载 SVG，导出仍包含全部 13 节点；导出前后的主题、视角、折叠、节点数量及布局修订状态未变化。
- 重置关闭详情、恢复初始分组并保留当前主题。
- 浏览器 context 设置 offline=true 后通过 file:// 加载，无 HTTP/HTTPS 请求，无 pageerror。
- 禁 JavaScript 仍列出全部 13 个节点摘要；完整无脚本图由独立 SVG 提供。
- 独立打开 SVG，确认标题、Mermaid 条件、反馈标签、13 个节点与 13 个箭头；检查了整张静态图截图与 PNG 内容，边界完整。
- PNG 文件头与实际尺寸匹配导出报告；没有靠文件扩展名判定成功。

已人工查看截图：1366-initial.png、1366-node-detail.png、1366-feedback-detail.png、1920-initial.png、375-initial.png、375-detail.png、1366-no-js.png、svg-independent-open.png，以及最终 agent-runtime.png。截图显示浅色低饱和背景、蓝色顺序主路径、长虚线反馈与清晰的阶段边界。此例为细长流程，桌面两侧留白较多，首次打开只显示前段，属于当前纵向流程布局的阅读取舍。

## 遇到的问题

1. **本机 npm 命令冲突。** `Get-Command npm` 指向 `C:\Windows\system32\npm`，命令退出为 0、无输出，但 Playwright 文件不存在。`Get-Command npm.cmd` 指向 `D:\Node-JS\npm.cmd`，使用 npm.cmd 安装成功（added 2 packages）。没有修改 PATH 或 Skill。
2. **无 JS 降级呈现存在小瑕疵。** 摘要内容完整，但页面仍展示不可工作的主题/导出/缩放工具栏及“正在准备图形…”提示。证据为 1366-no-js.png。这不阻塞正常 JS 阅读或独立 SVG 使用，但不应宣称无 JS 页面只保留摘要。
3. **第一次验收脚本断言过严。** 自写脚本错误要求无 JS 文本含数字“13”，而实际是逐项列出全部节点；核对后改为验证每个节点标签都存在。原始失败保存在 verification-first.json，不属于 Skill 缺陷。
4. **直接 SVG 的 fullPage 截图超时。** 第二次已成功读取独立 SVG 的 13 节点与 13 箭头，但 Playwright fullPage 截图 30 秒超时。改用 800×2800 的固定视口覆盖整图，截图成功；历史记录在 verification-second.json。这是截图方式问题，不是导出文件丢失或渲染失败。

## 边界与未验证项

- 本图只有一层分组，两层嵌套折叠未在此真实任务中验证；没有添加与原图无关的嵌套结构来凑测试。
- 没有真实分叉、异常路径、数据库、并发 fork/join 等源材料，未声称本次覆盖这些能力。
- 验证浏览器为本机 Chromium；其他浏览器、其他系统字体、触控硬件与屏幕阅读器没有实机验收。
- 未验证源图描述的 Agent Runtime 代码实现、生产行为或 Mermaid 输出分支。箭头方向和反馈返回位置依然是显式假设。
- 这次结果证明此 Skill 能从给定 SVG 独立完成本例交付，不等于对所有规模、文字长度和图结构的全面认证。
