# M2 ELK 布局与几何验证记录

本页记录 2026-09-23 的 M2 正交布局快照。2026-09-24 的当前实现优先多段斜线路由，按碰撞诊断回退正交，并修正斜线端口贴边；实际产物与复验见[微服务连线报告](routing-colour-enhancement.md)。下文原始测试计数和当时未验证项仅作阶段记录。

日期：2026-09-23。实现边界：`src/layout/elk.ts`、`src/layout/geometry.ts`；测试：`tests/unit/layout.test.ts`、`tests/unit/layout-geometry.test.ts`。测量、渲染、阅读器、构建与示例由主实现集成。

## 实现

- `layoutGraph(graph, view)` 保持既有 `MeasuredGraph → LayoutGraph` 契约。ELK layered 使用正交路线，方向为 RIGHT / DOWN。
- 两层分组作为真实 compound graph 提交 ELK；组标题独立预留 `max(56, title.height + 24)`，其余 padding 24，节点间距 32，基本层间距 64。
- 节点、端口和边标签都有显式测量尺寸。端口为零面积连接锚点，按边分别创建；不占显示区域、不共用业务 ID。
- 生成专用内部 ID 区分 root / group / node / edge / port。原始图、原始边映射、条件与方向不修改。
- 节点和组按父级坐标逐层累加。边及边标签按 ELK 返回的 `edge.container` 解释坐标，不假设它们相对 `root.edges` 所在位置。依据：[ELK coordinate system](https://eclipse.dev/elk/documentation/tooldevelopers/graphdatastructure/coordinatesystem.html)。
- 绘制前将首末端口移到真实形状轮廓；支持 decision、胶囊、圆角框和当前 store 三次 Bézier 外形；端口修正沿原正交线进行，不改变边的方向。
- 所有阅读器与导出调用共用串行 Promise 队列；失败释放队列，后续请求可继续。UI revision/coalesce 仍由阅读器调度器负责。
- `checkGeometry(graph)` 返回统一 `Diagnostic[]`：非有限尺寸、节点重叠、容器包含、标题可用宽度、文字超界、非端点穿线、组标题穿线、标签/画布/节点/标题重叠等。普通边交叉不当成图关系错误；过长画布是 warning。

## 实际失败及修复

### M1 原型的缺失能力

先运行实际 M1 prototype 上的新回归用例：4 项中 1 项通过、3 项失败。失败分别为 DOWN 方向不生效、两层组没有输出、两条不同条件边标签位置完全相同。换用 ELK 实现后通过，原型保留供 M1 记录。

### Store 端口在上盖附近的斜线

补充端口回归后重现：位于 `y=103` 的水平端点被错误夹到 `y=112`，会让水平末段变斜。改为求三次 Bézier 对应横向交点，保留 y 不变；fixture 实测端点 `(131.25, 103)`。

### 部署复合图触发 ELK 0.11 上游排序缺陷

主实现浏览器检查发现 `deployment-cross-group.diagram.json` ready 失败，错误为 `TypeError: Cannot read properties of undefined (reading 'a')`。将同一真实 JSON 经 projection 和手工测量 fixture 送入 Node adapter，稳定复现。

ELK bundled 源码堆栈定位到 `Ccc` 的 `Sort By Input Model` 和 `ylc` comparator：存在跨组回向关系时，层级虚拟节点缺失 comparator 需要的 model ID。`NODES_AND_EDGES` 与 `PREFER_NODES` 均重现；`NONE` 可正确完成。

最小修订：仅复合图关闭该不安全的输入排序 pass，仍按输入顺序构造元素、固定 randomSeed=1、保留主路径优先级。无组图保持 `NODES_AND_EDGES`。未删除节点、组、边、无向关系或条件；真实 fixture 的 6 节点、4 组、7 条关系完整，几何 error 为空。此处不承诺复合图绝对遵循输入顺序。选项语义参考：[ELK consider model order](https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-considerModelOrder-strategy.html)。

### 短标签重复占用层间距

实测两个 224 px 节点间的 24 px 标签（加背景后 34 px）：CENTER 布局为标签创建虚拟层，实际间距 `64 + 34 + 64 = 162 px`。将 `edgeNodeBetweenLayers` 从 24 改 12 不改变这个结果。

边标签统一改为靠源端的 TAIL，条件更接近判断来源，且不额外插入 CENTER 虚拟层。相同 fixture 间距变为 100 px，仍保留至少 64 px 层间距。这是通用标签布局选择，不按总览示例 ID 硬编码。长标签仍由 ELK 预留实际空间；全套回路、分支、同端点标签、嵌套组回归通过。

### 合法的两行长组标题被上方入组边穿过

将 `decision-shared-endpoint` 的组标题改为“校验处理分组包含需要保留的完整中文职责说明”后，浏览器 V07 在初始展开态报 `EDGE_GROUP_TITLE_INTERSECTION`。以同一模型和 238×40 的两行标题测量尺寸建立 Node 回归，重现 `/edges/0 enter → checks` 穿标题。

根因：只预留组 padding，未把组标题的实际尺寸提交为 ELK node label；复合图入组边可能通过留白标题区。修复为在每个 compound node 上声明实际宽高的标题 label，设置 `INSIDE H_LEFT V_TOP`，让 ELK 将标题纳入入组边布局。保留原字号、方向、关系、标题碰撞 error 与组 padding。修复后布局/几何测试增至 15/15，typecheck 通过；实际字体浏览器复验由主实现重建后运行。

## 验证结果

当前执行快照（独立 M2 模块，不替代最终交付报告）：

| 命令 | 结果 |
| --- | --- |
| `node --import tsx --test tests/unit/layout*.test.ts` | 14/14 通过；包含真实 deployment 失败回归 |
| `npm.cmd run typecheck` | 退出码 0 |
| `npm.cmd run test:unit` | 42/42 通过，退出码 0；本次约 9.4 秒 |
| `git diff --check -- src/layout/elk.ts src/layout/geometry.ts tests/unit/layout.test.ts tests/unit/layout-geometry.test.ts` | 无输出 |

更早一次全量单元检查为 35/39，4 个失败均来自仍在开发的 CLI 测试，已通知主实现；随后完整复验 42/42 通过，不将早期失败省略为从未发生。

14 项布局/几何检查覆盖：单节点、RIGHT/DOWN、测量尺寸保持、两层标题留白与包含、原始数据不可变、跨组边起止坐标、不同条件标签、feedback、自环、原始边聚合映射、并发调用与失败恢复、父组绘制顺序、LCA edge.container、真实部署复合图、短标签空白层、菱形/胶囊/store 外形、节点/文字/标签/组标题碰撞。

## 集成与未验证边界

- 主实现需要重新构建浏览器资源，重跑真实浏览器 fixture 与截图；此模块测试使用手工测量尺寸，不能替代实际字体和 SVG DOM 验证。
- 跨组边的 comparator 修复应在相同 deployment fixture 的浏览器输出再复验；旧 `artifacts/layout-check.json` 的失败记录不能自行当成已更新通过。
- 当前几何穿线检查采用节点外接矩形作保守障碍：路由通常由 ELK 避开外接矩形；对于任意外部构造的布局，擦过特殊形状空角可能仍被诊断，不能据此推断源模型错误。
- 检查发现问题会提供诊断，不自动删除节点或条件。ELK 不能保证任意合法规模都零交叉或视觉紧凑，仍需人工审查截图。
- 主实现正在按实测主线程长任务实现内嵌 Blob Worker。Node 与浏览器引擎拆分由主实现负责；本记录不宣称 Worker 性能、file:// 或导出已验证。
- Node 单测耗时不是最终的浏览器 ready/重排 p95；目标性能与完整规模正确性以独立性能记录为准。
