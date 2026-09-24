# 微服务示例与连线视觉复验

2026-09-24，针对复杂图中全直线、硬直角和单色箭头的反馈，完成通用布局与渲染调整，并用电商下单微服务示例检查实际效果。示例是教学假设，不代表任何真实系统；支付仅画同步返回确定结果的场景，异步回调、处理中和超时仍需按真实系统另行建模。

## 设计与实现

- ELK 分层布局优先使用多段斜线；若几何校验发现路径穿过非端点节点或分组标题，则仅对该图重试一次正交布局。两种路线的安全转折都绘制短半径圆弧，端口侧、箭头末段、原始边和条件不变。可能侵入节点、组标题或边标签的折点会保留原样，不强行圆角化。
- 普通流程、数据和依赖箭头按来源节点着色；浅色和深色主题各有 18 个对应色位。异常红、反馈琥珀及其虚线语义仍独立。当前示例的 18 个原始节点各得不同色位，折叠数据分组后已显示连接的来源颜色不变；超出色板容量的其他图可能复用颜色，因此箭头、标签和线型仍是必要依据。
- 微服务模型明确画出第三方支付返回支付服务的同步结果，包含库存不足、支付失败及释放预留的条件方向。[图数据](../../examples/traditional-microservices.diagram.json)是人工审核入口；HTML 详情板可修改既有节点、边和分组字段并重新布局。

## 实际浏览器与静态产物

[桌面](../../artifacts/screenshots/traditional-microservices-v2-desktop.png) · [宽屏适应画布](../../artifacts/screenshots/traditional-microservices-v2-wide.png) · [375px 窄屏](../../artifacts/screenshots/traditional-microservices-v2-narrow.png) · [深色主题](../../artifacts/screenshots/traditional-microservices-v2-dark.png) · [离线 HTML](../../examples/traditional-microservices.html) · [完整 SVG](../../images/system-blueprint-traditional-microservices.svg) · [PNG](../../images/system-blueprint-traditional-microservices.png) · [JPEG](../../images/system-blueprint-traditional-microservices.jpg)。[较早的正交路由草图](../../artifacts/screenshots/traditional-microservices-before-routing.png)可供视觉对照；草图之后还补齐了支付渠道的返回边，因此它不是同一模型的像素级 A/B 测量。原始 v1 与 v2 总览的同尺度对比另见[视觉对照](../../artifacts/visual-comparison.html)。

最终示例为 **18 节点、21 关系、5 分组**；浏览器几何错误为 **0**。独立 SVG 为 **1610×3997**，21 条可见路径中 15 条包含圆弧指令，实际用了 13 种连线颜色；2 倍 PNG/JPEG 为 **3220×7994**，内容、签名和尺寸均由示例检查核对。HTML 为 **1,782,153 bytes**，可在断网 `file://` 环境打开。横向临时布局虽在全屏查看较清楚，但 SVG 达 5898×1236，放入 900px 宽的 README 时文字仅约 15% 原尺寸；因此正式示例采用纵向 1610×3997，README 缩略图用于总览，阅读细节请点开 SVG 或 HTML 放大。

本轮源码的类型检查、构建、66 项单元测试、45 项真实 Chromium 测试、7 份示例生成和只读复查均通过。浏览器用例检查了圆弧、多来源配色、箭头与连线同色、折叠后颜色稳定、选中态、深色主题、静态导出和离线无请求。分发与压力图的实测见[性能报告](performance.md)和[分发报告](../../artifacts/package/report.json)。

## 已知边界

- 长链路在宽屏“适应画布”下文字很小，这是整体比例而非缩小节点字号；需放大平移或按主题拆图。图不支持手工拖拽排版，复杂结构调整仍应修改 JSON 后重新生成。
- 第三方支付保持在自有业务服务分组之外，因此同步回传线较长。把外部渠道塞进交易域虽会缩短该线，却容易误示服务归属；当前保留清楚的边界。
- 色板在超过 18 个来源的图中会复用。颜色只辅助追踪，不能单独代表条件、方向或关系类型。
- Memory / Recall 旧示例有一条连线穿过另一条边的标签背景；旧正交图中也存在，当前碰撞回退不处理此类边与其他边标签的遮挡，需要人工审图。其他边的标签被遮挡不应被解释为数据丢失。
