# 使用 System Flow

System Flow 根据你提供的仓库、文档或系统描述生成可审核的技术图。先确认图的读者和范围，再整理组件、连接、方向、条件及来源；不能把自动生成的关系当成已核实的系统事实。图数据使用 [JSON Schema](../system-flow/references/diagram-schema.json)；字段说明见[建模规则](../system-flow/references/modeling.md)，布局与截图检查见[视觉规则](../system-flow/references/visual-guidelines.md)。

## 生成与交付

需要 Node.js 24.x。以下命令在仓库根目录执行，输入也可以换成自己的 `.diagram.json`：

```bash
node system-flow/scripts/validate.mjs examples/traditional-microservices.diagram.json
node system-flow/scripts/generate.mjs examples/traditional-microservices.diagram.json --output output/microservices.html
```

生成的 HTML 是单文件，可在断网环境通过 `file://` 打开。拖动平移，滚轮缩放，底栏可适应画布、切换横向 / 纵向。点击节点、连接或分组查看详情和上下游；在详情板修改已有字段后，先保存修改，再分别下载修订 JSON 和 HTML。浏览器不会自动覆盖原文件。

浏览器可直接下载 SVG。自动导出静态图需先在 Skill 子目录安装 Playwright 与 Chromium：

```bash
npm ci --prefix system-flow
node system-flow/node_modules/playwright/cli.js install chromium
node system-flow/scripts/export.mjs output/microservices.html --format svg --output output/microservices.svg
node system-flow/scripts/export.mjs output/microservices.html --format png --scale 2 --output output/microservices.png
node system-flow/scripts/export.mjs output/microservices.html --format jpg --background "#FFFFFF" --output output/microservices.jpg
```

输出文件已存在时命令会拒绝覆盖；确认要替换时加 `--overwrite`。静态导出默认完整展开，不包含当前的缩放、选中状态或流向动画。PNG/JPEG 使用本地 Chromium；HTML 阅读和浏览器内 SVG 下载不需要额外安装。

## 人工审核边界

详情板可以改已有节点、连接和分组的名称、说明、条件、方向、来源等，但不能新增或删除对象、修改 ID，也不会改变真实系统代码。涉及结构变化时编辑 JSON，重新校验和生成。布局生成后仍应检查中文长文本、箭头方向、跨组线、分支和回路，以及桌面和窄屏效果。

兼容入口 `python system-flow/scripts/export_diagram.py` 可以把旧静态 SVG 或含静态内联 SVG 的旧 HTML 导出位图；旧图不能自动无损转成可编辑的 v2 数据。详细限制和 Skill 安装方法见 [SKILL.md](../system-flow/SKILL.md)。
