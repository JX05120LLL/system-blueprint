# 详情审核、配色与流向升级验收

2026-09-24，本机 Windows 10.0.26200、Node 24.14.0、Playwright 1.58.2、Chromium 145.0.7632.6。此报告对应 [范围修订](editor-enhancement.md)、[微服务连线升级](routing-colour-enhancement.md)和当前工作区；初始 v2 的 22 项验收设计及历史记录仍见 [v2 验收报告](v2-validation-report.md)。本轮变更尚未提交或推送，之前远程 CI 的成功记录不代表本轮代码已在 CI 验证。

## 可直接检查的产物

- [可编辑的总览 HTML](../../examples/overview.html)、[图数据](../../examples/overview.diagram.json)、[独立 SVG](../../images/system-blueprint-overview.svg)、[PNG](../../images/system-blueprint-overview.png)、[JPEG](../../images/system-blueprint-overview.jpg)。其余六份示例见 [示例目录](../../examples/README.md)。
- 实际 Chromium 截图：[桌面详情](../../artifacts/screenshots/overview-review-details.png)、[编辑表单](../../artifacts/screenshots/overview-review-edit.png)、[保存回图](../../artifacts/screenshots/overview-review-saved.png)、[390×844 窄屏](../../artifacts/screenshots/overview-review-narrow.png)。[新旧视觉对照](../../artifacts/visual-comparison.html) 和 [六份示例截图](../../artifacts/screenshots/overview-v2-desktop.png) 可继续比较。
- [可安装 Skill ZIP](../../artifacts/system-blueprint-v2.zip)：29 个文件、580,414 bytes、SHA-256 `7ce259690de54e66ee217ebc2692aa459289658851dc3c99f8aa7e709879a14c`。逐文件摘要见 [archive.json](../../artifacts/package/archive.json)。

## 实测结果

| 检查 | 结果与证据 |
| --- | --- |
| 类型检查、构建 | `npm.cmd run typecheck`、`npm.cmd run build` 通过；`check:build` 从源码重新比对 20 个分发文件，无差异。 |
| 单元测试 | `npm.cmd run test:unit` 66/66 通过。新增来源字段无损往返、编辑校验、圆弧路径、斜向端口和 18 色位检查。 |
| 浏览器测试 | `npm.cmd run test:browser` 45/45 通过，0 跳过。包含原 V01–V22 对应回归、详情审核和微服务路由/配色/折叠检查；[机器结果](../../artifacts/browser-results.json)。 |
| 示例 | `examples:generate`、`examples:check` 均 7/7 通过；[报告](../../artifacts/examples-report.json)。实拍桌面、窄屏与深色视图，并检查详情板不遮挡当前选中节点。 |
| 离线修订 | 在 `file://` 中修改名称、摘要、说明后，画布、详情、独立 SVG 和下载的 JSON 一致；下载修订 HTML 后断网重新打开仍保留修改，无外部请求；禁用脚本的摘要也已更新。 |
| 正确性边界 | 判断条件重复时拒绝保存，原图与已接受数据不变；保存布局中锁定表单/取消，旧结果不覆盖新状态；编辑折叠聚合边后重新映射原始边选择；无改动保存不产生撤销历史，来源路径保持原样。 |
| 交互与动效 | 上下游、折叠、撤销/重做、缩放平移仍通过；流向实际 `stroke-dashoffset` 随时间变化，可暂停。系统减少动态效果在页面打开后切换也会更新，用户主动播放可覆盖该偏好。静态导出无动画。 |
| 导出与兼容 | 浏览器/CLI 测试验证 SVG 独立打开、PNG/JPEG 实际签名、内容及尺寸；当前总览 SVG 为 1,632×321，PNG/JPEG 均为 3,264×642，像素采样确认有实际图形内容。旧 HTML/SVG、Node/Python 导出回归通过。未保存草稿阻止下载，避免误导为已修订版本。 |
| 独立分发 | `test:package` 7 步通过：仓库外中文空格路径、未安装依赖时 validate/generate、本地缺失 Playwright 的明确错误、在副本安装后 SVG/PNG/JPEG 导出；[报告](../../artifacts/package/report.json)。ZIP 解压到仓库外再次运行 validate/generate 成功，`package:skill -- --check` 通过。 |

第一次全量浏览器运行有 1 项测试超时：新增“未保存草稿禁止下载”后，旧无效编辑用例仍等待下载事件。测试改为取消无效草稿后再检查已接受数据，定向 1/1 和当时完整 44/44 重跑通过；产品代码无需回退该保护。示例生成曾在 Windows 覆盖单个 SVG 时出现一次 `UNKNOWN copyfile`，随后完整重跑和只读复查均通过，未复现。新增微服务检查后当前套件为 45/45。

## 性能与限制

[性能完整记录](performance.md)来自当前源码重新测量的 30 节点 / 45 边 / 3 组标准样本：未压缩 HTML **1,782,775 bytes（约 1.700 MiB）**，目标 ≤3 MiB；首次就绪 10 次 p95 **261.7 ms**，目标 ≤1,500 ms；折叠/展开 20 次 p95 **65.4 ms**，目标 ≤500 ms。100/300/20 上沿图就绪 465.7 ms，折叠 252.2 ms，完整 SVG 导出 210.5 ms；首次就绪无长任务记录，折叠/导出阶段记录到一次 54 ms 主线程任务。这些是指定机器和模型的实测，不代表所有设备或拓扑。

详情板只编辑现有节点、连接和分组的结构化字段；添加/删除对象、改 ID、自由拖拽布局不在本轮范围。`file://` 不会原地覆盖源文件，关闭前应下载修订 JSON 或 HTML；图中的“已证实”标记仍需人工核对来源，也不会修改真实系统代码。上沿样本过宽，PNG/JPEG 按既有限额拒绝，需拆图。Firefox/Safari、真实触控和屏幕阅读器尚未实机验收；本轮没有新的远程 CI 结果。
