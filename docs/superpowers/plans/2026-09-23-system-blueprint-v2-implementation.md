# System Blueprint v2 实施记录

依据：`../specs/2026-09-23-system-blueprint-v2-design.md`。用户已授权按方案 M0–M5 连续完成，常规决策自主处理，不 commit/push/发布。原有未跟踪 `.idea/`、`docs/` 保留。

## 约束与执行

- 源模型只读；schema 是结构唯一来源；类型与 Ajv 独立校验器由构建生成。
- 测量、可见图投影、ELK 布局、SVG、交互、导出分模块。静态导出全展开、无 UI 状态。
- 预构建资源随 `system-blueprint/` 分发；生成只需 Node 24；导出从 skill 内解析 Playwright。
- 所有展示内容以文本处理；HTML 数据转义；legacy 页面脚本禁用，网络请求拒绝。
- 22 项验收映射到单元、浏览器、兼容、分发、示例及性能记录；视觉必须检查真实截图。
- 主代理负责构建、渲染、浏览器集成；独立代理负责有明确文件边界的模型模块和后续审查。保留实施记录，不提交代码。

## 阶段任务与验证

1. **M0 基线与骨架**：保存旧模板和五张 SVG；复现旧 HTML 导出问题；建立 npm/TS/esbuild/Playwright 配置、schema、语义诊断及单元测试。先验证坏输入、分支、循环和分组。
2. **M1 视觉样板**：当前总览数据、浅/深色 tokens、测量与统一 SVG、精简外壳和缩放。输出 1366×768 新旧实际截图及可打开 HTML，再继续通用布局。
3. **M2 通用布局**：ELK compound adapter、局部坐标转换、特殊形状、条件标签、几何诊断。覆盖中文、回路、自环、跨组连接。
4. **M3 阅读交互**：索引遍历、详情、聚合映射、双层折叠、串行 revision 调度、键盘及窄屏。保留初始与交互状态截图。
5. **M4 打包与导出**：生成/校验/导出 CLI、原子写入、防覆盖、限制、legacy 与 Python、独立 SVG/位图、包复制验证。
6. **M5 迁移与交付**：五类共六份模型与 HTML、静态图和对比合成、README/Skill/references/默认提示词、CI、性能记录、独立 skill 使用评估及 diff 审查。

## 验收命令

`npm ci`、`npm ci --prefix system-blueprint`、`node system-blueprint/node_modules/playwright/cli.js install chromium`、`npm run typecheck`、`npm run test:unit`、`npm run build`、`npm run test:browser`、`npm run test:package`、`npm run examples:check`。实际 Windows 执行采用 `npm.cmd`。

## 进度与决定

- 初始 HEAD：`35320ab8010cfb5cfec4d02be96c7f09f127712e`；Git 仅 `?? .idea/`、`?? docs/`。
- Node：v24.14.0；Python：3.13.1。不存在项目或父级 AGENTS.md，遵循用户提供的全局规则。
- 保留原设计文档的历史状态表述；实施结果写在本记录及验证报告，避免把原规划改写成预先已实现的事实。
- M0：旧模板确实复现 `ValueError: The SVG size is undefined`；备份位于 `tests/fixtures/legacy/`。模型单元 22/22、类型检查通过。
- M1：真实 Chrome 153.0.8010.50、离线上下文完成截图，5节点4箭头，文字边界无溢出，画布579/768px。截图 `artifacts/screenshots/overview-v2-m1.png`。临时简单布局仅用于先审视觉，M2 替换相同接口。
- 本机浏览器硬件路径对旧 SVG 截图超时，关闭 GPU 后同一内容成功；浏览器自动化统一使用 `--disable-gpu`，这是环境适配，不绕过渲染检查。
- 用户补充 drawio-skill 参考，取舍见 `docs/validation/drawio-reference.md`；保留既定技术路线与全部原始边。
- M2：ELK 复合图接入同一测量/渲染接口。修复 compound 模型排序崩溃、局部坐标、特殊节点端点、长组标题穿线和多出口标签重叠；保留原始关系与文本，不以缩字号或删边处理。
- M3：原图只读索引、原始 ID 映射、串行最新 revision、两层折叠、高亮、键盘和详情完成。实际窄屏暴露初始视角偏离起点，已改为对准入口；审查后补齐详情重绘、边和非首组的焦点恢复。
- M4：独立 Node 校验/生成/导出入口、Python 兼容、全展开 SVG/PNG/JPEG 和仓库外分发完成。回归修复旧 viewBox 尺寸错误、真实 JPEG、小数 scale 元数据、CSS 计算尺寸限制、PNG 背景语义、半透明与渐变祖先背景。
- 性能初测：上限样例在主线程布局记录到 204/364ms 长任务，因此引入内嵌 Blob Worker；后续测量与离线复验见最终性能报告。Worker 失败有明确错误/30秒超时，不回退到阻塞主线程。
- M5：六个模型和交互文件对应五类示例；保留原五张 README SVG 路径，新增 PNG/JPEG 和同尺度 Before/After。源数据事实/假设/规划逐项记录，独立 Agent 仅凭复制 Skill 和原始 Runtime SVG 完成交付并进行 29 项本例检查。
- 最终审查：文字/几何诊断改为原始 JSON 路径和 ID；禁用 JavaScript 时隐藏不可用工具栏，保留完整摘要。独立审查发现与修复记录见 `docs/validation/final-review.md`。
- 完整验收状态以 `docs/validation/v2-validation-report.md` 和 `docs/validation/performance.md` 为准；本台账的阶段快照不是最终测试计数。
