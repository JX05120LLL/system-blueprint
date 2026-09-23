---
name: system-blueprint
description: Use when users request architecture diagrams, system blueprints, deployment topology, component or integration maps, request/control/data flows, Agent Runtime or Memory/Recall diagrams, Before/After comparisons, or updates to existing technical HTML/SVG diagrams.
---

# System Blueprint

把仓库、文档或描述转为可离线阅读的技术图。默认交付可持续修改的 `.diagram.json` 与自包含交互 HTML；按需附独立 SVG、PNG、JPEG。默认浅色工程风，支持深色。用户明确要求 Mermaid 时遵循其格式。

## 路由与工作流

1. 确定读者、范围、图类型和交付格式。总览/部署偏 RIGHT，流程和 Memory 偏 DOWN；Before/After 用两份同粒度文档。合理可推断时直接推进。
2. 阅读 [建模规则](references/modeling.md) 和 [JSON Schema](references/diagram-schema.json)。先提取节点、边界、方向、条件及来源；保持稳定 ID。区分 confirmed、assumed、planned。
3. 在用户工作目录保存图数据。最多 100 节点、300 边、20 组与两层分组；超限拆图。原模型保留所有必要分支、回路和条件，details 保存长说明；不手写布局坐标。
4. 运行校验并修复具体诊断，再生成 HTML。不要直接修改打包资源或为每张图重写模板。
5. 按 [视觉与验收规则](references/visual-guidelines.md) 实际打开、操作并检查截图。生成成功不等于视觉通过；文字必须先测量再布局，不能缩小字号掩盖溢出。
6. 按要求导出全展开静态图，独立打开验证；交付文件链接、范围、关键假设和验证结果。保留 JSON 方便重生成。

## 可执行入口

将下列 `<skill-dir>` 替换为当前 Skill 的绝对安装目录；输入/输出使用用户工作目录的绝对路径，可含中文和空格。

```powershell
node "<skill-dir>/scripts/validate.mjs" "<work-dir>/diagram.json"
node "<skill-dir>/scripts/generate.mjs" "<work-dir>/diagram.json" --output "<work-dir>/diagram.html"

# 仅自动静态导出需要安装这些依赖
npm ci --prefix "<skill-dir>"
node "<skill-dir>/node_modules/playwright/cli.js" install chromium

node "<skill-dir>/scripts/export.mjs" "<work-dir>/diagram.html" --format svg --output "<work-dir>/diagram.svg"
node "<skill-dir>/scripts/export.mjs" "<work-dir>/diagram.html" --format png --scale 2 --output "<work-dir>/diagram.png"
node "<skill-dir>/scripts/export.mjs" "<work-dir>/diagram.html" --format jpg --background "#FFFFFF" --output "<work-dir>/diagram.jpg"
```

校验/生成只需 Node.js 24.x 与完整 Skill 目录，不依赖仓库源码、根 node_modules 或浏览器。阅读者只需浏览器。新命令覆盖已有文件要显式加 `--overwrite`；退出码：0 成功、2 输入/参数错误、1 依赖/渲染失败。详细参数使用 `node "<skill-dir>/scripts/export.mjs" --help`。

## 交付边界

- HTML 内嵌数据、CSS、JS 和布局 Worker，不使用 CDN、网络字体或服务端；file:// 下可缩放、平移、详情、高亮和折叠。
- 折叠不修改原图；不同条件不合并。静态导出始终完整展开，不继承当前视角、选中态或工具栏。
- HTML 的 details 也会完整分享。只收录必要说明与引用，不包含凭证、真实用户记录或整份私有配置。
- 无法运行浏览器时继续交付可完成的 JSON/HTML，并明确视觉或导出未验证。
- 旧 v1 HTML/SVG 按语义人工重建模型，不承诺无损自动还原。`assets/legacy-template.html` 保留旧模板。
- 兼容入口 `python scripts/export_diagram.py` 保留 PNG/JPG 参数和覆盖行为；HTML 新增 Node/Playwright 依赖，旧 SVG 仍用 CairoSVG/Pillow。多 SVG 旧 HTML 要指定 `--svg-index`；旧 HTML 仅支持静态内联 SVG 的位图导出，不执行其页面脚本。
