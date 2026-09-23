# System Blueprint v2 交付与验收

2026-09-23，按设计 M0–M5 完成。实际执行环境为 Windows、Node 24.14.0、Chromium 145.0.7632.6、Playwright 1.58.2。未 commit、push、发布或部署；原有 `.idea/` 和设计文档保留。

## 直接使用与交付

- [完整 Skill 目录](../../system-blueprint/SKILL.md)；[可安装 ZIP](../../artifacts/system-blueprint-v2.zip)，29 个文件，575,052 bytes，不包含 node_modules。ZIP 内容已逐文件与目录核对，CRC 检查通过，摘要见 [archive.json](../../artifacts/package/archive.json)。解压后将整个 system-blueprint 目录放到 Skills 目录。
- [五类示例全部文件](../../examples/README.md)：6 份 JSON、6 份离线 HTML、各自 SVG/PNG/JPEG；另有同尺度 Before/After 三种静态格式，保留原 5 张 README SVG 路径。
- [新旧效果对照](../../artifacts/visual-comparison.html)：原始 v1 与实际 v2 浏览器截图，另含 1920 桌面、375 窄屏与深色链接。
- [使用命令与依赖](../../README.md)、[性能实测](performance.md)、[语义迁移](example-migration.md)、[独立 Skill 使用评估](../../artifacts/agent-evaluation/EVALUATION_REPORT.md)。

生成只需 Node 24 和完整 Skill 目录，阅读只需浏览器。自动导出需在 Skill 自身目录安装锁定的 Playwright/Chromium；旧 SVG 的 Python 位图路径仍需 CairoSVG/Pillow。首次准备依赖需要下载，完成后的单文件 HTML 在断网 file:// 环境工作。

## 实际命令结果

| 命令或检查 | 结果 |
| --- | --- |
| `npm ci`、`npm ci --prefix system-blueprint` | 均退出 0；实际重新按 lockfile 安装 |
| `node system-blueprint/node_modules/playwright/cli.js install chromium` | 退出 0，使用已准备的 Chromium 缓存 |
| `npm run typecheck` | 退出 0；最后生成器换行修订后再次通过 |
| `npm run test:unit` | 47/47；之后生成器换行修订又跑 CLI 5/5 |
| `npm run build` | 退出 0，生成 validator、类型、阅读器、CLI、许可与 manifest |
| `npm run check:build` | 20/20 字节一致；精确版本、两份 lock、已安装依赖、Playwright 与 schema 一致 |
| `npm run test:browser` | 32/32，35.1 秒；0 skipped、0 flaky、0 unexpected |
| `npm run test:package` | 仓库外复制后 7 步通过；无 npm 安装生成成功，再独立安装并导出三种格式 |
| `npm run examples:generate`、`npm run examples:check` | 6/6；模型、嵌入数据与当前打包资源一致，离线就绪、文字边界、静态格式及尺寸通过 |
| `npm run test:performance` | 标准 10 次 ready / 20 次折叠，上限 100/300/20 完整性与轨迹通过 |
| 独立 Agent 依 Skill 完成真实任务 | 13 节点 / 13 边 / 4 组交付；该任务 29 项检查通过 |
| Git diff 审查 | 审查发现的 3 项 P2 已修复；`git diff --check` 通过 |

机器记录：[浏览器](../../artifacts/browser-results.json)、[示例](../../artifacts/examples-report.json)、[构建](../../artifacts/build-consistency/report.json)、[分发](../../artifacts/package/report.json)、[性能](../../artifacts/performance/results.json)。阶段报告保留当时测试数量和失败历史，最终状态以本报告及上述最终记录为准。

## 22 项验收对应

“通过”指以下输入和操作在本机真实执行，不外推为任意图形、系统或浏览器均已验证。

| 用例 | 状态与证据 |
| --- | --- |
| V01 单节点无边 | 通过。有限尺寸与 fit、Tab/Enter 详情、完整 SVG；布局单元及 acceptance 浏览器用例。 |
| V02 中英文长文本 | 通过。真实字体测量、两行标题/说明、不丢字符；超长明确拒绝且定位原始字段；浅深截图与文字 getBBox 检查。 |
| V03 判断出口 | 通过。成功/失败条件和箭头在展开、折叠及导出保留；共享端点不合并不同标签。 |
| V04 回路与自环 | 通过。真实路径渲染、遍历终止，上下游节点/边集合精确符合原图。 |
| V05 两层折叠 | 通过。父子交替恢复子状态；隐藏节点/子组选中态与焦点转到可见父组，原 JSON 不变。 |
| V06 条件与原始边映射 | 通过。不同条件保留；同条件聚合详情列全量原始 ID、说明和来源。 |
| V07 连续操作与失败恢复 | 通过。快速连续折叠/主题切换只提交最新 revision，待处理请求合并；测量失败保留最后成功图，reset 恢复。 |
| V08 缩放后完整导出 | 通过。独立全展开布局，无工具栏/选择/高亮，无视角裁切；导出前后阅读器状态不变。 |
| V09 注入片段 | 通过。script/img/fetch 字面文本、特殊 ID 和来源均按文字处理，无执行、额外元素或网络请求。 |
| V10 中文空格与覆盖 | 通过。实际文件读写、创建目录、防覆盖与原子发布；新入口显式覆盖、Python 原覆盖行为均测试。 |
| V11 非法模型 | 通过。缺失端点、重复 ID、组循环/层级、未知字段/版本、断裂主路径有具体诊断与非零退出；折叠诊断指向原始路径。 |
| V12 限额 | 通过。节点/边/组/details/2MiB 边界、scale/16,000px/40M 像素拒绝；CSS 计算尺寸在 Cairo 分配前检查。 |
| V13 独立分发 | 通过。中文空格临时副本与仓库外 cwd，无安装可生成；本地 Playwright 缺失先报错，副本 npm ci 后三格式导出。 |
| V14 file:// 离线 | 通过。内嵌 Worker、缩放平移、详情高亮折叠与主题正常；无外部请求；无 JS 时只显示摘要。 |
| V15 SVG/PNG/JPEG | 通过。SVG 单独重开、样式/箭头自包含；PNG/JPEG 实际签名、像素尺寸、不透明背景，1.2/1.5 倍元数据与像素一致。 |
| V16 键盘和375px | 通过。工具栏无横向越界，详情可关闭；Enter/Space/Escape 与重排后焦点恢复；首屏对准入口，拖动不误选。 |
| V17 旧入口 | 通过。原模板尺寸错误已消失；旧五 SVG、CSS/继承字体、半透明/渐变/内嵌背景、多 SVG 选择、禁脚本与外链拒绝。 |
| V18 五类迁移 | 通过。6 模型全部核对来源/假设/规划；桌面/窄屏/浅深/静态图实际生成与截图审查，原 SVG 路径保留。 |
| V19 隐藏条件 | 通过。折叠摘要提示判断/条件数量，详情显示所有条件；展开及静态导出完整恢复。 |
| V20 混合边语义 | 通过。decision 只计算流程出口；无向流程拒绝；flow 与 overview 高亮集合分别精确验证，无向依赖只列直接关联。 |
| V21 小于25%总览 | 通过。375px 长流程主动 fit 可低于25%，放大为当前倍率×1.25，无跳变；32 节点/31 边保留。 |
| V22 Before/After 合成 | 通过。相同 marker/gradient ID 加独立前缀，引用无缺失；同字号/比例，顶部对齐，完整最大边界与位图。 |

## 视觉与内容审查

M1 先用真实总览模型完成浅/深视觉样板，再接通 ELK 通用布局；[M1 截图](../../artifacts/screenshots/overview-v2-m1.png) 与 [检查记录](../../artifacts/m1-visual-check.json) 保留。M1 使用 Chrome 153，最终全套新旧对照统一使用 Chromium 145，不把不同浏览器像素差异当成产品回归。

最终六份示例均在 1366×768、1920×1080、375×812 生成截图；1366 下画布约占视口 75.4%，超过 70% 目标。逐图检查方向、容器、可见条件、文字和静态边界。长纵向图在“适应画布”下文字会小，默认用 80% 入口视角；这不是文本缩字号。桌面横向总览、部署图清楚呈现主线，长流程需平移或分组阅读。

关键状态：[长文字](../../artifacts/screenshots/long-text-light.png)、[隐藏条件详情](../../artifacts/screenshots/hidden-conditions-details.png)、[两层折叠](../../artifacts/screenshots/nested-parent-collapsed.png)、[聚合条件边](../../artifacts/screenshots/shared-conditions-edge-details.png)、[375px 总览](../../artifacts/screenshots/narrow-overview.png)。原 13 个 Runtime 概念去向、Memory 历史源及条件、部署具体连接假设、Before/After 的 LLM 规划均在迁移台账说明，没有把示例当成已部署服务。

## 审查修复与独立使用

[独立审查](final-review.md) 提出的 R1 原字段定位、R2 焦点、R3 祖先背景已全部修复。R1/R2 有真实浏览器先失败后通过记录；R3 渐变原先导出为白色，修复后左右像素为 (252,0,3)/(3,0,252)，透明叠色、偏移/缩放背景图和显式背景同时回归。其他开发中发现的 ELK compound 崩溃、长组标题穿线、部署多出口标签重叠、真实 JPEG 和小数位图尺寸也保留了回归用例。

独立 Agent 只获得复制后的 Skill、原始 Runtime SVG 和实际需求，未读取本仓库源码/示例/实施报告；成功独立建模、调用命令、离线打开和导出。其 HTML 是评估时的冻结副本，报告指出的无 JS 工具栏瑕疵已在最终模板修复并加入正式套件；不改写评估历史来掩盖发现。参考用户提供的 drawio-skill 所采用的原则与未采用范围见 [参考记录](drawio-reference.md)。

## 剩余限制与未验证项

- [性能报告](performance.md) 区分目标与本机实测：1.680 MiB、ready p95 232.2 ms、折叠 p95 50.4 ms；不是跨设备保证。100/300/20 的长链 SVG 完整，但最低位图倍率仍超尺寸限额，需拆图。
- 自动布局不保证任意拓扑都紧凑或零交叉。图过长是明确警告，节点/标签遮挡为错误，不能靠删边、缩字号或裁切交付。
- Linux/Windows GitHub Actions 已配置并检查 YAML，本次没有远程运行；本机完整通过不能代替远程 runner 证据。Linux CI 负责两项 Cairo SVG 专项，Windows CI保留路径/离线/HTML 委派检查。详见 [构建与CI](build-ci-report.md)。
- Firefox/Safari、其他系统字体、触控硬件、屏幕阅读器与长期压力未实机验收。可用触控手势来自 d3-zoom，不能从鼠标测试宣称真实触控设备已验证。
- 仓库外分发验证的是依赖与路径闭合，没有用操作系统权限让整个仓库物理不可访问；导出器已明确拒绝借用根目录 Playwright。
- legacy 仅导出选定的静态内联 SVG 区域；动态页面脚本、外部资源和整页截图不在兼容范围。CairoSVG 不承诺所有浏览器滤镜效果。

本轮无剩余已确认的 P1/P2 实现问题或环境阻塞。上述范围边界与未运行环境均保留，不以“编译通过”替代效果或交互验证。
