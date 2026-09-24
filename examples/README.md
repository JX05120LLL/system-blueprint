# 演示图

这里仅保留 README 展示的两张教学示意图。图中的组件、关系与“假设”均需按实际系统审核；JSON 是可修改的源数据，HTML 可离线打开并在详情板修订已有对象。两图均可在画布底栏切换横向 / 纵向。

| 演示 | 图数据 | 离线交互 | README 预览 |
| --- | --- | --- | --- |
| 传统电商微服务架构总览 | [JSON](traditional-microservices.diagram.json) | [HTML](traditional-microservices.html) | [PNG](../images/traditional-microservices-preview.png) |
| 传统电商下单流程 | [JSON](traditional-microservices-order-flow.diagram.json) | [HTML](traditional-microservices-order-flow.html) | [GIF](../images/traditional-microservices-order-flow.gif) |

重新生成：在仓库根目录执行 `npm run examples:generate`。只读检查现有交付：`npm run examples:check`。两张图的默认方向都是横向。SVG/PNG/JPEG 不随仓库预存；需要时按[使用说明](../docs/usage.md)从 HTML 导出，静态图始终完整展开，不受当前缩放、折叠与选中状态影响。
