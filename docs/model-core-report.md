# System Blueprint v2 模型与投影验证记录

日期：2026-09-23。范围：模型 schema、语义校验、原始图索引与折叠投影；不代表浏览器布局、视觉、离线导出或性能已验收。

## 已实现

- `system-blueprint/references/diagram-schema.json` 是 draft-07 结构契约：未知字段拒绝，严格版本与枚举，100 节点 / 300 边 / 20 组，details 最多 8,000 个 Unicode 字符。至少一个节点；ID 和必需标签不得全为空白。
- `src/model/types.ts` 从生成的 `DiagramDocument` 导出业务别名，不另维护第二套手写文档结构。固定诊断包含 `code/path/ids/message/severity`。
- `validateDocument(unknown)` 先检查序列化后 UTF-8 的 2 MiB 上限，再调用构建生成的 Ajv standalone 校验器，最后检查引用、同命名空间 ID、分组深度/环/空组、decision 条件、fork/join、流程有向性、初始折叠及主路径。不会补默认值或改写原文档。CLI 仍须检查原始文件字节，防止空白字符绕过输入文件限额。
- 普通回路和自环合法。无向连通性分量与 flow 从 start 无法到达的流程节点给出警告，不拒绝图数据。没有 start 的流程不推断入口。
- `buildGraphIndex(document)` 提供原节点、边、组 Maps，incoming/outgoing，以及包含所有后代的 groupMembers 和由近到远的 nodeAncestors。
- `findRelated(index, selectedId, direction)` 从节点或组成员集合进行有向遍历，visited 防止循环；flow 仅遍历 control/exception/feedback，overview/deployment 遍历所有有向边。无向关系仍可在直接关系详情读取。
- `projectVisibleGraph(document, collapsedGroups?)` 不修改原图或折叠集合。父组折叠后再次展开可恢复子组状态；跨组条件、方向、类型以及每条原始边映射保留。
- 摘要节点公开 `originalGroupId/originalNodeIds/hiddenDecisionCount/hiddenConditionLabels/hiddenEdgeIds`。summary 只包含节点数，阅读器应根据显式计数另行测量并绘制必需的隐藏判断/条件提示，避免说明重复。
- 只有折叠映射后的端点、方向、类型和完整 label 一致时聚合；真实未折叠自环保留。生成 ID 使用数字索引并避开全部原节点、组和边 ID；不把任意组名拼进生成 ID。
- 显式传入空 Set 得到导出所需全展开图。`nodeToVisible` 用于原图关系高亮投影。

## 验证证据

先添加模型与投影行为测试，运行观察到缺失模块，补接口占位后 18 项行为断言全部失败；随后实现。额外 ID 安全和有向不可达场景分别观察红灯后修复。

2026-09-23 本机 Node v24.14.0：

- `npm.cmd run test:unit`：22 / 22 通过，其中本模块 21 项、文字换行模块 1 项。
- `npx.cmd tsc --noEmit --pretty false`：退出码 0。
- `git diff --check`：退出码 0；已有 `.gitignore` 的 LF/CRLF 提示来自并行工作，不修改其格式。

覆盖 V01、V03、V04、V05、V06、V11、V12、V19、V20 的纯模型部分，包括：100/300/20 支持上沿，超限失败，中文详情字符/UTF-8 字节区别，两层父子折叠、不同条件同端点、内部隐藏条件、循环遍历、视图类型过滤、主路径错误，以及在四种折叠组合中每条原始边恰好出现一次（可见映射或内部隐藏映射）。

Ajv 的 ESM standalone 源码最初仍含 helper `require`；构建负责人已将其经 esbuild bundle 后生成自包含 ESM。最终上述正常命令不需要 require shim。类型生成启用 `ignoreMinAndMaxItems`，让动态数组保持正常 TypeScript 接口，运行时数量约束继续由 schema 执行。

## 剩余验证责任

- 所有图索引和投影入口接受经过 `validateDocument` 的文档；无效文档不得进入布局。
- 纯单元测试不证明摘要提示实际可见、几何正确、焦点恢复或异步 revision 调度；这些由阅读器浏览器测试覆盖。
- 复制 skill 后的校验与生成依赖闭合、原始文件 2 MiB 检查、实际导出格式及位图上限由 CLI/分发测试覆盖。
