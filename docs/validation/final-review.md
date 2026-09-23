# v2 独立实现审查

日期：2026-09-23。基线：`35320ab8010cfb5cfec4d02be96c7f09f127712e`。范围包括未提交 diff 与新增的 `src/`、`scripts/`、测试、模型和分发代码。

审查依据为 `docs/superpowers/specs/2026-09-23-system-blueprint-v2-design.md`。本次审查不修改实现，不运行 build 或 Playwright，不 commit/push；仅在 Node 中运行了不写文件的投影、测量诊断和布局探针。本报告不代替主任务的完整浏览器、性能、示例或独立分发验收。

## 审查问题与修复跟踪

### R1 · P2 · 折叠后的文字诊断指向错误的原始字段 — 源码已修复，独立探针通过

原位置：`src/layout/measure.ts:28–38`，`src/projection/visible-graph.ts`。

测量使用投影数组索引拼接 `/nodes/<i>/label`、`/edges/<i>/label`。折叠会删除节点、生成摘要并聚合边，因此这些索引不再是输入 JSON 的索引。以 `decision-shared-endpoint.diagram.json` 为基础，将 `groups[0].label` 设为全展开能容纳、折叠需要三行的标题，然后折叠 `checks`，原实现报告 `/nodes/1/label` 和合成 ID `__blueprint_group_0`；实际错误源是 `/groups/0/label`，原始 `/nodes/1` 是“请求有效？”节点。这会误导按字段修正图数据的用户或 Agent。

主实现已增加 `sourcePath` / `sourcePaths` 和原始 ID 传递。审查者用相同纯函数探针复验，现返回：

```json
{"path":"/groups/0/label","ids":["checks"],"severity":"error"}
```

探针使用固定文字宽度的最小 DOM 替身，仅证明原始路径和 ID 映射正确，不声称替代真实字体测量。真实字体/浏览器回归由主任务执行。

### R2 · P2 · 重绘或关闭详情后键盘焦点丢失/错位 — 已修复，浏览器回归通过

位置：`src/viewer/index.ts:63–68`、`src/viewer/index.ts:98–107`；详情重建在 `src/viewer/details.ts:8`。

原实现只判断 `scene.contains(document.activeElement)`。在分组详情的“折叠分组”按钮上按 Enter 后，布局提交会通过 `showDetails()` 删除该按钮；由于原焦点在 details 内，不会执行恢复，键盘失去当前上下文。边详情同时将 `focusId` 清空，关闭按钮/Escape 无法回到原边。

主实现已增加详情区域焦点检测及边的原始 ID 恢复，并报告三个真实浏览器回归先失败后通过。审查者随后发现新选择器的边界：对于已展开的组，`visibleId` 为 `undefined`，直接判断 `el.dataset.nodeId === visibleId` 会在第一个组元素上误命中，因为两者都是 `undefined`。复现为在 `nested-loops` 中选择展开的 `child`，再关闭详情：应回到 `child`，不能回到排在前面的 `parent`。已通知主实现给 node/edge ID 匹配增加非空保护，并增加多组回归。

最终验收应同时覆盖：详情按钮触发重排、普通边/聚合边关闭详情、多组中非首组关闭详情，以及内部对象折叠后的可见焦点。

### R3 · P2 · legacy HTML 丢失父容器的渐变或背景图 — 已修复，实际像素回归通过

位置：`src/cli/legacy.ts:61–69`、`src/cli/legacy.ts:85–90`。

兼容导出只读取祖先 `backgroundColor`，将其压成一个不透明像素，然后移除原祖先节点。祖先的 `backgroundImage`、渐变及定位信息均未进入导出容器。合法自包含静态输入例如：

```html
<div style="background:linear-gradient(to right,red,blue)">
  <svg width="200" height="80"><text x="10" y="40">Test</text></svg>
</div>
```

不传 `--background` 导出 PNG 时，浏览器中的红蓝渐变应出现在图区域背后；当前实现只看到祖先透明的 `backgroundColor`，最终使用白色底，静默改变图像。旧模板把渐变放在 SVG 自身，其正常导出不能证明父容器 CSS 背景也能保留。

建议保留图区域对应的背景绘制层或祖先背景上下文，并以左右像素颜色断言验证；显式 `--background` 的覆盖规则另行固定。本项是源码可确定的数据丢失路径，审查者没有自行运行浏览器。

## 其他审查结论与验收边界

- 未发现原始模型被折叠、主题、高亮或导出改写的实现路径。不同条件的聚合签名、原始边映射、真实自环保留、两层折叠及有向可达遍历与方案一致。
- 布局调度只提交最新 revision；独立导出强制空折叠集合并通过同一布局队列运行。导出背景覆盖了根 SVG 与内部图，位图尺寸在截图前检查。
- 生成器对内嵌 JSON 与显示文本做转义；新 CLI 使用临时文件和排他 hard link 发布实现默认防覆盖；Playwright 从 Skill 自身安装目录解析。未发现这些路径中的新增 P1 问题。
- Blob Worker 源码内嵌并使用 Blob URL，无相邻 Worker 文件依赖；本次审查不把源码检查等同于 `file://` 离线实测。
- CI、构建一致性检查、完整套件、五类示例截图、性能及独立 Agent 使用评估在主任务并行完成，不能把本报告作为这些项目的通过证据。最终状态以总验证报告与实际命令输出为准。

截至写入本报告，R1 已独立复验源码修正；R2、R3 的最终状态须由主任务补记。除此之外，本轮未提出其他 P1/P2 实现缺陷。

## 主任务最终复验补记

R1 的真实折叠测量错误现指向 `/groups/0/label` 与 `checks`，不再指向合成节点；几何诊断也映射原始路径/ID。R2 已对普通边/聚合边关闭详情、面板按钮触发重排、非首个展开组、父组隐藏子组的焦点做回归；`undefined === undefined` 误匹配已增加非空保护，先失败后通过。R3 以真实 PNG 检查渐变、透明叠色、偏移且缩放的内嵌图片、显式背景覆盖，原白色结果与修复后的两端颜色均保留在 `artifacts/compatibility/r3-*`。

最终整套浏览器 **32/32**、单元 **47/47**、类型检查、构建一致性 **20/20**、独立分发及六份示例检查通过。详见 [总验证报告](v2-validation-report.md)。三项审查问题已关闭；不以此结论宣称未运行的远程 CI 或其他浏览器已通过。
