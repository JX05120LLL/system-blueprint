# 图数据与内容建模

结构以 [diagram-schema.json](diagram-schema.json) 为准；本文件解释语义与取舍。原始模型不保存坐标，修改时保留稳定 ID。

## 选择视图与范围

| 需求 | view.kind / direction | 应保留 |
| --- | --- | --- |
| 系统、组件、集成总览 | overview / RIGHT | 内外部边界、关键依赖、关系含义 |
| 请求、控制、Memory / Recall | flow / RIGHT 或 DOWN | 起止、所有判断条件、不执行路径、异常与回路；按主阅读方向与可用空间选择 |
| 部署拓扑 | deployment / RIGHT | 部署位置、服务与存储、跨区连接 |
| Before / After | 两份独立文档、相同主题与方向 | 相同基线 ID 和粒度；新增能力明确 planned |

同一份图数据的折叠只改变可见投影，不能删分支、删回边或自动传递约简原始关系。若为 README 等场景另做架构总览，可建立独立的摘要模型，但须保留并交付完整原始图数据，链接承载判断和补偿的流程子图，明确哪些步骤被聚合。完整模型中的关键条件仍保持可见，长说明放纯文本 details。

复杂架构和跨组长链路先尝试 RIGHT，使主路径便于从左到右阅读；简单纵向流程或窄幅交付可考虑 DOWN。选定方向后检查实际截图、静态全图与标签位置，必要时调整方向或拆图。方向选择不改变原始边的 source/target，也不能以省空间为由隐藏条件或回路。

## 必要字段与引用

- 文档：`schemaVersion: "2.0"`、id、title、view、nodes、edges、groups；description 可选。
- view：kind、direction (`RIGHT|DOWN`)、theme (`light|dark`)；collapsedGroups 为初始折叠组 ID；primaryPath 为按顺序连续的有向边 ID，不指定时不推断主干。
- node：id、kind、label；可加 summary、details、groupId、evidenceStatus、sources。kind 为 start/end/process/decision/store/external/fork/join。
- edge：id、source、target、kind、directed；可加 label、details、evidenceStatus、sources。kind 为 control/data/dependency/exception/feedback。
- group：id、label；可加 parentId、details。节点和组共用 ID 命名空间；边 ID 在文档内唯一。原始边端点只能引用节点。
- sources：`[{ "path": "src/service.ts", "line": 12 }]`。path 是可读的仓库相对引用；不会自动打开文件或执行链接。
- evidenceStatus：confirmed 表示有依据，assumed 表示假设，planned 表示规划；缺省 assumed。这不是运行状态，也不能把源码中一个概念当成线上服务。

引用原有图片时，区分“图中有这个概念”与“已有实现”。源码、配置、文档或明确需求可以作为依据。没有实际证据的具体调用、失败策略或新增能力分别标 assumed/planned，并在影响理解的可见说明中解释。

## 流程校验

control、exception、feedback 必须 directed=true；data/dependency 可以无向。无向依赖表示直接关联，不纳入上下游遍历。

decision 必须至少有两个流程出口，每条出口条件非空且可区分。data/dependency 不计为判断分支，不能为了满足检查补写虚假的“是/否”。fork 至少两个 control 出口；join 至少两个 control 入口。普通循环与自环合法。

flow 高亮只遍历流程子图；overview/deployment 遍历所有有向关系。折叠组从成员集合查询，不表示任意内部入口都可到达任意出口。

## 最小可运行模型

将以下内容保存为工作目录中的 `request.diagram.json`，再调用 Skill 的 validate / generate 入口：

```json
{
  "schemaVersion": "2.0",
  "id": "request-check",
  "title": "请求校验",
  "description": "输入通过校验后返回成功，否则明确返回错误。",
  "view": { "kind": "flow", "direction": "DOWN", "theme": "light", "primaryPath": ["enter", "pass"] },
  "groups": [],
  "nodes": [
    { "id": "start", "kind": "start", "label": "收到请求" },
    { "id": "check", "kind": "decision", "label": "校验通过？" },
    { "id": "ok", "kind": "end", "label": "返回成功" },
    { "id": "error", "kind": "end", "label": "返回错误" }
  ],
  "edges": [
    { "id": "enter", "source": "start", "target": "check", "kind": "control", "directed": true },
    { "id": "pass", "source": "check", "target": "ok", "kind": "control", "directed": true, "label": "通过" },
    { "id": "fail", "source": "check", "target": "error", "kind": "exception", "directed": true, "label": "不通过" }
  ]
}
```

## 限额与诊断

最多 100 节点、300 边、20 组；至少一个节点。UTF-8 JSON 文件最多 2 MiB；每个 details 最多 8,000 个 Unicode 字符。分组最多两层，不能成环或为空。超限必须报错，不能静默截断。

固定诊断结构为 `{ code, path, ids, message, severity }`。结构、引用、条件、方向错误阻止生成；不连通或流程不可达警告需要核对并在交付说明。未知字段与版本拒绝读取。

浏览器另行测量标题最多两行、summary 最多两行、边标签最多三行。字符限额与实际排版限制不同。遇到 TEXT_OVERFLOW 时精简措辞、将实现说明转入 details 或拆子图；不能缩小字号，也不能删除必要条件。

## 折叠与编辑

原图始终完整；折叠只是可见投影。摘要会提示隐藏判断/条件，跨组条件仍显示；点击摘要或聚合边可读原始关系。父组展开恢复子组之前的折叠状态。静态导出一律全展开。

增量修改优先编辑 `.diagram.json` 并保留 ID。只有 v2 HTML 时，可从 `script#blueprint-data` 读取 JSON；不要从当前折叠后的 SVG 反向猜测原图。v1 HTML/SVG 没有完整模型，按语义人工重建或保留旧文件局部修订，不承诺自动无损还原。

图模型会完整嵌入 HTML，details 也属于交付内容。仅收录必要说明和来源；不包含密码、令牌、真实用户记录或整份私有配置。折叠不能脱敏。
