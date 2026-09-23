# 五类示例迁移说明

日期：2026-09-23。旧图语义基线见 [acceptance-plan.md](acceptance-plan.md) 第 3 节，原 SVG 保存在 `tests/fixtures/legacy/`。此记录区分内容建模、实际实现与待核实关系，不把旧示意节点当成线上组件。

## 模型交付

| 类别 | JSON / HTML 名称 | 节点 / 边 / 组 | 关键表达 |
| --- | --- | --- | --- |
| System Overview | overview | 由总览样板单独维护 | 输入 → Agent 建模 → diagram.json → 离线阅读 → 静态导出；示例索引不再占主流程。 |
| Runtime Flow | runtime-flow | 9 / 10 / 4 | 四阶段保持；原 13 个概念合并到节点与 details；检查返工及用户修改分支明确为 planned。 |
| Memory / Recall | memory-recall | 8 / 9 / 3 | 明确请求/强匹配才检索，否则留在当前上下文；未命中/失败为 assumed；结果进入上下文组装。 |
| Deployment Topology | deployment-topology | 11 / 10 / 3 | 保留用户、应用、数据、外部能力；具体端点和调用方向全为 assumed。 |
| Before / After | before、after | 3 / 2 / 0；4 / 4 / 3 | frontend/api/database 与两条基线 edge ID 相同；after 增加部署职责边界与明确 planned 的 LLM 扩展。 |

五类共六份 JSON 和六份独立 HTML。README 保留原五个 `images/system-blueprint-*.svg` 路径；Before/After 的第五张静态图由两个完整导出 SVG 按相同比例合成，交互分别打开 before.html / after.html。

## Runtime：原 13 个概念的去向

| 原概念 | 新节点 / 保留方式 |
| --- | --- |
| User Prompt、Skill Trigger | request：材料输入与 Skill 适用性，具体来源在详情。 |
| Scope Decision、Output Mode | scope：图类型、读者、格式；旧 Scope Decision 没有条件，因此保持 process。明确 Mermaid 路线按用户要求处理。 |
| Model Extraction | extract：节点、分组、边界、方向、输入输出和来源。 |
| System Simplification、Visual Grammar | refine：控制粒度、稳定 ID、必要关系、语义形状与浅色规范；未删除必要条件。 |
| Template Composition、SVG Rendering、Self-contained File | generate：采用 v2 校验、测量、ELK、交互与离线打包；旧 Hero/卡片模板机制不再沿用。 |
| README / Docs | deliver：HTML、JSON 和必要静态图及验证说明。 |
| Feedback Loop | feedback：新增“需要调整 / 确认交付”两个 planned 条件；需要调整返回 extract。 |
| Iterated Output | done：完成本次可核对交付。 |

另加 review 判断“通过 / 未通过”，未通过反馈到 refine。旧 SVG 没有这些显式回边，本版是工作流规划的具体表达，不谎称恢复了原图箭头或已有自动执行服务。

## Memory：来源、选择与结果

- session 保留 Message / Session Summary，以当前会话为基础；intent 保留 continue/new/compare/recall。
- policy 保留“用户明确要求或强匹配”条件，并增加直接可见的“否则不检索”路径。
- retrieve 的详情完整列出 Trips、Plan Options、Session Summaries、Messages；原图只提有序检索，未证明精确来源顺序，本版不虚构先后或查询实现。
- context 的详情保留 Session Memory、Plan Memory、User Preferences 的原职责；Recall 始终按需，不自动注入所有历史。
- match 的命中判断及“未命中或检索失败 → 保留当前上下文”明确 assumed。检索结果与不检索路径最终都到 context，然后交给后续任务。
- 分组由真实文字尺寸驱动，原 Recall Policy 越出父容器 26 单位的问题交由几何与浏览器检查验证，不再手写固定坐标掩盖。

## Deployment：不从原线位置推断事实

保留 Browser/Mobile/Internal tools 的入口含义、CDN/WAF、FastAPI、Agent Core、PostgreSQL、Redis、Qdrant、Maps API、Weather API、Search、Messaging/TTS。后三个边界分别表达云入口与应用区、数据与记忆区、外部服务。

原图只有五条区域/节点连接，没有分别连接全部数据库和外部服务。本版将每条精确关系记录为 assumed，并在图标题下说明。节点对应旧图概念不等于该组件已在本仓库部署；具体框架配置、表结构、调用与方向仍需真实项目证据。

## Before / After：共同粒度与明确新增

双方共同节点稳定 ID：frontend、api、database；共同边：frontend-api、api-database。标签、基线职责、方向、主题一致。Before 原 API 线未接数据库外框，现关系明确标 assumed，避免将线位置误当实现证据。

After 的三个组区分客户端、应用、数据职责。旧 Client Layer / Application Layer / Data & Memory 的说明保留在对应节点详情。旧图额外出现的 LLM 作为第四节点 llm，节点和 api-llm/llm-api 两条新增边均 planned，明确说明是能力扩展，不宣称仅更换配色。

## 本阶段验证与后续责任

已对新增五份 JSON 运行真实 `validateDocument`：全部 valid，无 error 或 warning。保留分支、回路和原来源含义的人工对照以上述旧图台账为依据。

静态资产由根任务统一运行生成/导出/合成。HTML 就绪、中文文字、容器边界、跨组方向、各截图、PNG/JPEG 格式和最终文件链接是否存在，必须以生成后的实际浏览器与文件检查为准，不能从本语义核对记录直接推断已全部视觉通过。

Skill 主入口现按图类型路由到 references，保留结构/截图双验证与稳定 ID；参考 drawio-skill 的取舍见 [drawio-reference.md](drawio-reference.md)，未引入 draw.io、Graphviz、在线服务或自动删边功能。

最终集成补记：六份 JSON/HTML 与各自 SVG/PNG/JPEG 已实际生成；`examples:check` 6/6 通过，无外部请求/pageerror、无文字越界或几何错误，原五张 README SVG 已在静态格式/尺寸核对后替换。各文件及截图见 [示例索引](../../examples/README.md) 和 [总验收](v2-validation-report.md)。总览模型最终为 5 节点/4 边/0 组；其 v2 生成与导出能力已实现，原样板的 planned 状态更新为 confirmed。
