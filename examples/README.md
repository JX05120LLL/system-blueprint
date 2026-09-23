# 示例产物索引

五类共六份独立模型。下载 HTML 后可直接离线打开；GitHub README 内的 SVG 是静态图。PNG/JPEG 使用默认 scale=2，完整展开，不受阅读器视角影响。

| 示例 | 可修改数据 | 交互阅读 | 静态图 |
| --- | --- | --- | --- |
| overview | [JSON](overview.diagram.json) | [离线 HTML](overview.html) | [SVG](../images/system-blueprint-overview.svg) · [PNG](../images/system-blueprint-overview.png) · [JPEG](../images/system-blueprint-overview.jpg) |
| runtime-flow | [JSON](runtime-flow.diagram.json) | [离线 HTML](runtime-flow.html) | [SVG](../images/system-blueprint-runtime-flow.svg) · [PNG](../images/system-blueprint-runtime-flow.png) · [JPEG](../images/system-blueprint-runtime-flow.jpg) |
| memory-recall | [JSON](memory-recall.diagram.json) | [离线 HTML](memory-recall.html) | [SVG](../images/system-blueprint-memory-recall.svg) · [PNG](../images/system-blueprint-memory-recall.png) · [JPEG](../images/system-blueprint-memory-recall.jpg) |
| deployment-topology | [JSON](deployment-topology.diagram.json) | [离线 HTML](deployment-topology.html) | [SVG](../images/system-blueprint-deployment-topology.svg) · [PNG](../images/system-blueprint-deployment-topology.png) · [JPEG](../images/system-blueprint-deployment-topology.jpg) |
| before | [JSON](before.diagram.json) | [离线 HTML](before.html) | [SVG](../images/system-blueprint-before.svg) · [PNG](../images/system-blueprint-before.png) · [JPEG](../images/system-blueprint-before.jpg) |
| after | [JSON](after.diagram.json) | [离线 HTML](after.html) | [SVG](../images/system-blueprint-after.svg) · [PNG](../images/system-blueprint-after.png) · [JPEG](../images/system-blueprint-after.jpg) |

Before / After 同尺度合成：[SVG](../images/system-blueprint-before-after.svg) · [PNG](../images/system-blueprint-before-after.png) · [JPEG](../images/system-blueprint-before-after.jpg)。

[新旧效果与桌面/窄屏/深色截图](../artifacts/visual-comparison.html) · [语义迁移说明](../docs/validation/example-migration.md) · [完整验证](../docs/validation/v2-validation-report.md)

重新生成：在仓库根目录执行 `npm run examples:generate`。检查已有交付：`npm run examples:check`。
