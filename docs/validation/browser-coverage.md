# 阅读器浏览器验收

日期：2026-09-23。实际使用仓库 Playwright / Chromium，通过 `file://` 打开生成的单文件 HTML，浏览器 context 设为 offline。每个用例调用已构建的 `generate.mjs`，不使用开发服务器。最后一轮包含新接入的内嵌 Blob Worker。

命令：`npx.cmd playwright test tests/browser/acceptance.spec.ts --workers=1`。

结果：**16 / 16 通过，12.9 秒**。此前两轮为 14 / 14、16 / 16；新增了聚合详情、失败恢复和真实 Tab 入口后再次完整运行。`npx.cmd tsc --noEmit --pretty false` 在新增测试文件后通过。

| 用例 | 实际检查 |
| --- | --- |
| V01 | 无边单节点的正尺寸、有限 fit 变换；Tab→Enter→关闭详情→恢复焦点；无 details 的节点仍有有用信息；SVG 输出；没有远程请求或 pageerror。 |
| V02 | 真实中文标题与长英文标识符均为两行且完整，summary 为两行；DOM `getBBox()` 检查文字没有越出形状外框，字号未缩小；浅深主题截图。 |
| V02 错误路径 | 结构合法但标题过长时 ready reject，错误包含节点 ID、`/nodes/0/label` 与两行限制；错误面板可见，没有生成截断图。 |
| V03 / V06 | decision 的成功/失败边共享端点但标签与箭头独立；折叠后仍两条边；关系详情保留原始 ID、条件和说明，边详情没有上下游入口。 |
| V04 | 真实自环及 feedback 被绘制；上下游在循环图中终止且节点/边集合精确匹配预期；Escape 清除高亮并恢复节点焦点。 |
| V06 聚合 | 相同条件的两条跨组原边合并为可见边后，详情分别列出两个 ID 及两份说明。 |
| V05 / V16 | 内部节点折叠后转选组并恢复可见焦点；父子组使用 Space/Enter 交替折叠/展开，子组状态保持；展开恢复全部原始边；内嵌 JSON 原文不变。 |
| V07 队列 | 同步发出九次折叠操作与三次主题切换，最终 revision=committedRevision，合并为不超过两次布局；最终 child 折叠、dark 主题且画布匹配。 |
| V07 失败恢复 | 组标题在展开时合法、折叠时超出两行，whenIdle reject 后保留最后成功图并显示错误；reset 清除失败状态且成功重排。 |
| V08 | 缩放与鼠标平移不增加 layoutRuns；导出始终全展开 6 节点 / 6 边且含两条件，没有按钮、高亮或选择态；导出后阅读器视角、折叠及 layoutRuns 不变。 |
| V09 | 含 script/img/fetch 的标题、ID、详情与来源只显示文字；没有插入 script/img/image，没有执行标志或远程请求；恶意样式 ID 的组也可安全折叠。 |
| V16 拖拽 | 从节点内部实际拖动超过阈值，视角改变且不打开详情；后续普通点击仍可选择节点。 |
| V19 | 初始折叠摘要直接显示 1 判断 / 2 条件，组详情可读全部条件及组级关系边界；展开后完整恢复；reset 恢复初始折叠、清除选中高亮、保留当前深色主题。 |
| V20 | flow 和 overview 使用相同混合关系，得到不同且精确的高亮集合；无向 dependency 无箭头也不纳入遍历；data/dependency 仍在详情列出。 |
| V16 / V21 | 375×812 实际视口，显式 fit 低于 25%，再次放大为原倍率 1.25 倍；32 节点 / 31 边完整；工具栏不越界；详情可打开关闭且面板滚轮不缩放图。 |

截图保存在 `artifacts/test-results/acceptance-*/`，并作为 Playwright 附件：`single-node-offline.png`、`long-text-light.png`、`long-text-dark.png`、`shared-conditions-edge-details.png`、`nested-parent-collapsed.png`、`hidden-conditions-details.png`、`narrow-overview.png`。

已实际打开审查中文/英文文字、隐藏条件详情和窄屏总览截图：文字均留在边界内，隐藏条件提示可见；窄屏总览显示完整长链并提示放大阅读。总览比例下文字很小是显式 fit 的预期，默认首屏采用可读视角。

边界：这 16 项不替代独立 SVG 重开、PNG/JPEG 真实格式和尺寸、旧入口、仓库外复制分发、五类示例或性能检查。V10–V15、V17–V18、V22 的完整验收由其他脚本与最终报告覆盖。`getBBox()` 检查普通形状外框，不独自证明菱形内接区或所有连线无穿越；几何检查与人工图审仍是独立步骤。
