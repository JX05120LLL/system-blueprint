# 浏览器与性能 fixture

日期：2026-09-23。数据位于 `tests/fixtures/`。本记录说明图数据的固定语义与已执行的纯函数验证；实际浏览器、几何、截图、离线与导出结果由最终验证报告记录。

## 固定样例与预期

| 文件 | 节点 / 边 / 组 | 对应验收与稳定断言 |
| --- | --- | --- |
| `single-node.diagram.json` | 1 / 0 / 0 | V01；唯一节点 `only`。无连线、分组或 details，仍能选中并显示可用说明；适应与导出无除零。 |
| `long-text.diagram.json` | 3 / 2 / 0 | V02；`chinese` 为“中文请求与历史上下文完整性检查”（按阅读器 192 px 文本宽度验证中文两行标题）；`identifier` 为完整 `RequestContextNormalizationService`。summary 含显式换行。完整字符必须保留；不得缩字或加省略号。 |
| `decision-shared-endpoint.diagram.json` | 3 / 3 / 1 | V03、V06；组 `checks` 含 decision `check`。`success` 与 `failure` 都从 check 到 result，均为 control，条件分别“成功”“失败”。折叠后仍是两条独立跨组边，不合并。 |
| `hidden-conditions.diagram.json` | 6 / 6 / 1 | V19；初始折叠 `processing`。内部条件 accepted=“通过”、rejected=“不通过”，组出口 exit 无 label。摘要含 4 节点、1 判断、2 条隐藏条件。静态导出必须恢复全部 6 节点 / 6 边。 |
| `nested-loops.diagram.json` | 5 / 7 / 2 | V04、V05、V07；父组 parent、子组 child。check 的条件为“满足”“不满足”；retry 为 work→check；self-loop 为 audit→audit。先折 child、再折 parent、再展 parent，child 折叠状态应保留。 |
| `deployment-cross-group.diagram.json` | 6 / 7 / 4 | M2 跨层坐标；region 下有 compute/storage 两组，client-zone 独立。HTTPS、业务读写、发布/消费任务与外部通知都保留方向；shared-network 无向，不得画箭头或纳入方向遍历。 |
| `mixed-flow.diagram.json` | 7 / 6 / 0 | V20；check 的两个流程出口 allow/deny 有条件，另有 data=record 和 dependency=lookup。流程高亮不纳入两条后者。 |
| `mixed-overview.diagram.json` | 7 / 6 / 0 | 与 mixed-flow 完全相同的节点/边；只改变标题、说明、view.kind。overview 应纳入 record/lookup；无向 shared 始终排除。 |
| `injection.diagram.json` | 2 / 1 / 1 | V09、V14；标题含 `</script>`，节点/组 ID 含引号与标签片段，详情含 script/img/fetch 文本。`globalThis.__blueprintInjectionExecuted` 始终 undefined，且不存在远程请求；所有内容仅作文字展示。 |
| `narrow-long-flow.diagram.json` | 32 / 31 / 0 | V21；n01→…→n32，edge step-01→…→step-31。DOWN 布局，32 个节点不能删除。375 px 窄屏适应全图可低于 25%，继续放大倍率连续且可平移访问末端。 |
| `parallel-control.diagram.json` | 6 / 6 / 0 | fork 有两个 control 出口，join 有两个 control 入口；实际绘制 fork/join 符号，保留两个并行任务。 |

## 已复核的高亮结果

均以原始 ID 表示，结果包含被选起点：

- mixed-flow 选择 check，下游节点为 `check, done, failed`，边为 `allow, deny`。
- mixed-overview 选择 check，下游节点为 `catalog, check, done, failed, store`，边为 `allow, deny, lookup, record`。
- 两份混合图均不高亮 external 或无向 shared 边。

## 已复核的折叠结果

| 样例 / 折叠组 | 可见节点 / 边 | 隐藏原边 | 隐藏条件 |
| --- | --- | --- | --- |
| decision-shared-endpoint / checks | 3 / 3 | 无 | 无；“成功”“失败”仍在跨组边直接可见；隐藏判断数为 1 |
| hidden-conditions / processing | 3 / 2 | accepted、rejected、merge-ok、merge-error | 通过、不通过；隐藏判断数为 1 |
| nested-loops / child | 4 / 5 | allowed、retry | 满足、需要重试；隐藏判断数为 1 |
| nested-loops / parent | 3 / 3 | allowed、retry、audit、self-loop | 满足、需要重试、审计复核；隐藏判断数为 1 |

每份折叠图均实际检查：可见边的 `originalEdgeIds` 与摘要的 `hiddenEdgeIds` 合起来，恰好覆盖每条原始边一次，无删除或重复。生成摘要 ID 不是原 group ID；浏览器测试可用 `originalGroupId` 定位。

## 性能工厂

`tests/fixtures/factory.ts` 导出：

```ts
makePerformanceDocument(nodeCount, edgeCount, groupCount): DiagramDocument
```

- 节点 `n001` 起，边 `e001` 起，组 `g01` 起，输入相同时输出 JSON 完全相同。
- 先铺最多 nodeCount−1 条连接所有节点的主链；剩余边确定性生成跨节点的 data、dependency、feedback 关系，不因布局困难删边。
- 节点按连续区间分组，所有要求的组都包含节点。数量输入限制分别为 1–100、0–300、0–min(nodeCount,20)，非法数值抛出 RangeError。
- `(30,45,3)` 精确产生 30 节点 / 45 边 / 3 组；紧凑 UTF-8 JSON 为 **9,396 bytes**。
- `(100,300,20)` 精确产生 100 节点 / 300 边 / 20 组；紧凑 UTF-8 JSON 为 **47,442 bytes**。
- 这两个字节数仅指源 JSON，不能用作 HTML 体积或布局性能结果。

实际运行 40 组 node/edge/group 数量组合，覆盖 1、2、5、30、100 节点与 0、1、45、300 边，以及有组/无组；全部通过 validateDocument、精确数量和确定性检查。边数不足以连接所有节点的组合允许出现不连通警告。另检查 5 组非法参数均被拒绝。

## 当前验证结果与边界

- 11 份固定 JSON 已逐份运行 `validateDocument`：全部 valid，无 error 或 warning。
- 上述高亮、折叠映射和性能工厂语义断言均实际执行成功。
- 此阶段 `npx.cmd tsc --noEmit --pretty false` 未发现 fixture 类型错误；全仓当时仍有并行开发的 `src/export/svg.ts` 与 `src/viewer/details.ts` 集成错误。以最终全仓检查记录为准。
- 尚不能从本报告推断文字实际换行、组边界、移动端倍率、脚本注入防护或导出成功；这些必须由真实浏览器检查落实。
