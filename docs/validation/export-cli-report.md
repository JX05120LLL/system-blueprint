# M4 CLI、兼容与独立分发验证

本报告记录 Windows 本机实际结果；最终整套 V01–V22 状态以仓库总验证报告为准。

## 实现范围

- `src/cli/common.ts`：严格参数、UTF-8、JSON 读前 2 MiB 上限、输入错误退出 2 / 运行失败退出 1、临时文件完整写入后原子发布。新入口无 `--overwrite` 不覆盖，含并发发布时的防覆盖检查。
- `validate.ts` / `generate.ts`：共享结构与语义检查；不需要安装 Playwright。资源按脚本位置定位。
- `export.ts` / `legacy.ts`：Playwright 只从 skill 自身安装位置解析；验证接口存在并设置 30 秒超时；独立完整导出视图；PNG/JPEG 实际编码、后缀一致及尺寸限制。
- `export_diagram.py`：原参数与覆盖行为保留。SVG 动态加载 CairoSVG/Pillow；HTML 转交 Node/Playwright，不再依赖 BeautifulSoup 或先提取 SVG。PNG 保留原背景，历史 `#08111E` 默认背景只用于 JPEG。
- `check-package.mjs`：复制 skill 至系统临时目录中的中文空格路径，先无依赖生成，再按副本 lockfile 安装并导出。只在确认绝对路径归属后清理本次创建的临时目录；产物与执行记录归档。

## 已执行的回归

| 项目 | 证据与结果 |
| --- | --- |
| 参数/覆盖/限额/字段诊断 | `node --import tsx --test tests/unit/cli.test.ts`：5/5 通过。初次执行前 4 项均失败，含未知参数被忽略、空白填充 JSON 超 2 MiB 仍生成、缺 validate/export 命令。|
| 旧模板尺寸错误 | Node 与 Python 分别实际导出 `tests/fixtures/legacy/template.html`，scale 0.5 得到 700×430 PNG；没有 `viewBox → viewbox` 或尺寸未定义错误。|
| 旧 HTML CSS/脚本/多 SVG | 浏览器基线 6/6 通过，验证实际绿色像素、页面脚本不执行、多 SVG 必选索引、越界拒绝、legacy 不支持 SVG 自动导出。|
| 外部资源 | 远程 image 与缺失本地 CSS 明确退出 2；CSP 在原始内容前生效，legacy 禁止脚本。额外读取 CSSOM 以识别 CSS 转义后的资源 URL。|
| 缺导出接口 | 声称 v2 但无 `blueprint` API 的 HTML 快速退出 1，不无限等待。|
| v2 SVG/PNG/JPEG | SVG 独立重新打开、PNG/JPEG 魔数、尺寸、白色不透明角像素均有浏览器断言。命名背景 `white` 先归一为 `#ffffff` 再调用渲染接口，修复接口格式不匹配。|
| 小数 scale | scale 1.2 实测 overview PNG 1958×371；发现原元数据误报宽 1959，已修为 Chromium 四舍五入尺寸，限制检查仍向上取整保守执行。V15 增加元数据与真实像素尺寸对比。|
| Python CSS 尺寸限制 | 根属性 1×1、CSS width 16001px 的 SVG 初次错误成功；改在 Cairo 真正分配 surface 前检查计算后尺寸，定向测试现通过。|
| Python 可选依赖分离 | `python -S ...export_diagram.py ...template.html --format png --scale 0.5` 成功，禁用 site-packages 仍可通过 Node 输出。|
| Python 旧五图 | 原始 overview/runtime-flow/memory-recall/deployment-topology/before-after SVG 全部经 CairoSVG 路径导出 PNG 成功。|
| PNG 背景兼容 | 初次 Python PNG 误套 JPEG 默认深色，实际角像素与 Node 不同；修正后两入口模板 PNG 逐字节一致。|
| 半透明祖先背景 | 独立 HTML 黑色 body + 50% 白色容器，初次导出角像素错误为白色；补充背景颜色合成后实测为 `(128,128,128)`。该断言已加入 CSS 浏览器用例。|
| R3 祖先渐变与内嵌背景图 | 真实 PNG 像素测试先红：红蓝渐变导出为白色。修复为按原祖先背景尺寸/位置保留 CSS 背板，按 SVG 显示尺寸到自然尺寸统一缩放，浏览器完成透明叠色。普通渐变、50% 白色覆盖、带偏移且显示缩小的 data URI 背景图、显式背景覆盖均通过；文字仍存在。|
| 仓库外分发 | `npm run test:package` 7 步全部符合预期：无依赖 validate/generate 成功、未安装导出退出 1、副本 npm ci 成功、SVG/PNG/JPEG 成功。|

为避免多个 Playwright 进程同时清理共用 trace 目录，后续整套浏览器测试由根任务统一运行。本模块新增 9 个浏览器测试；上表定向结果不替代最终统一运行记录。R3 修复后定向执行 `npx playwright test tests/browser/legacy-export.spec.ts -g 'R3|inherited font|intrinsic size'`，3/3 通过；`npx tsc --noEmit` 通过。

## 产物与实测

- `artifacts/compatibility/`：旧模板、CSS、旧五图、PNG/JPEG 与 v2 独立文件。
- `artifacts/package/report.json`：每条命令、退出码、依赖安装位置与耗时。
- `artifacts/package/standalone.diagram.json`、`.html`、`.svg`、`.png`、`.jpg`：仓库外生成后归档。
- `artifacts/compatibility/r3-gradient-before.png` 与 `r3-gradient.png`：R3 修复前后真实 PNG；`r3-gradient-alpha.png`、`r3-embedded-image-offset.png`、`r3-explicit-background.png` 为其余回归产物，精确像素记录在 `r3-background-pixels.json`。
- 分发测试环境：Node v24.14.0、Windows、Playwright 1.58.2；使用已经安装的 Chromium OS 缓存，未借用仓库根目录的 npm 依赖。
- Python 旧 SVG 环境：Python 3.13.1、CairoSVG 2.9.0、Pillow 12.0.0。
- 此次独立分发 HTML 1,749,134 字节；样本为 4 节点、3 条边、1 个判断，不用此数值替代方案标准 30 节点性能样本。
- overview 初次 SVG 8,498 字节；scale 2 的 PNG/JPEG 均为 3264×618，分别 117,726 / 163,858 字节。布局/文案后续修订会改变这些产物，最终示例以重新生成版本为准。

## 兼容边界

- legacy HTML 只导出所选静态内联 SVG 区域；页面脚本不执行，外部资源拒绝，动态旧图须先重建模型。`--theme` 只支持 v2。
- legacy SVG 保留 CairoSVG 的渲染能力边界，不承诺复现全部浏览器滤镜。CairoSVG 不随 skill 预装。
- 系统字体跨机器可能不同；依赖安装和 Chromium 下载需要首次准备，生成后的 HTML 阅读不需要它们。
- legacy HTML 保留 SVG 自身计算样式、字体、滤镜，以及自包含祖先背景颜色、渐变和背景图。背景位置、尺寸、重复方式及透明叠色按原 SVG 区域恢复；导出仍限于所选 SVG 区域，显式 `--background` 覆盖祖先背景。
- 新 Node 命令覆盖需 `--overwrite`；兼容 Python 入口按原行为覆盖，输出在完整渲染后才原子替换。

本次未 commit、push 或修改 `.idea/`。
