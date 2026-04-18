# System Blueprint

一个面向 AI Agent 的通用技能包，用于从代码库、系统说明或自然语言描述中生成高质量的系统蓝图、架构图、部署拓扑图、运行时流程图和技术总览图。

这个项目的目标不是绑定某一个特定平台，而是尽量采用更通用的结构：

- `SKILL.md`
- `assets/`
- 可选的 agent 专属元数据

这样它就可以更容易适配：

- Codex
- Claude 风格 Skills
- OpenClaw 风格 Skills
- 以及其他支持 `SKILL.md` 工作流的 Agent 运行时

---

## 快速预览

下面这几张图可以直接嵌入 GitHub README，不需要额外的 HTML 容器。

### System Blueprint 总览图

![System Blueprint 总览图](./images/system-blueprint-overview.svg)

### Runtime Flow 运行流程图

![Runtime Flow 运行流程图](./images/system-blueprint-runtime-flow.svg)

### Deployment Topology 拓扑图

![Deployment Topology 拓扑图](./images/system-blueprint-deployment-topology.svg)

---

## 这个技能是做什么的

`System Blueprint` 用来解决一个很常见的问题：

很多 Agent 能很快生成 Mermaid 或文本版流程图，但这些输出通常有两个问题：

- 够快，但不够好看
- 看起来精致，但强绑定某个平台，难以迁移

这个技能希望在两者之间取一个平衡：

- 保持足够通用，便于跨 Agent 复用
- 保持足够有审美，能生成更适合展示的图
- 保持足够轻量，方便你自己修改、分发、二次开发

默认输出更偏向：

- 独立 HTML 文件
- 内联 SVG
- 深色技术风格
- 少依赖、易分享

Mermaid 在这里是“兼容 Markdown 的回退方案”，不是默认主输出。

更准确地说，这个 skill 现在支持三层输出：

- `HTML`：主展示载体，适合浏览器打开、演示、分享
- `SVG`：适合嵌入 README、文档、静态页面
- `PNG / JPG`：适合投递、截图式分享、对 SVG 支持不佳的平台

---

## 适合生成哪些图

这个技能主要适合以下场景：

- 系统架构图
- 系统蓝图
- 部署拓扑图
- 组件关系图
- 数据流图
- 请求流 / 调用链图
- Agent 运行时流程图
- Memory / Recall 流程图
- Before / After 架构对比图

典型输出是一份独立 HTML 文件，你可以：

- 直接浏览器打开
- 发给同事或客户
- 放进项目文档
- 导出为 PDF
- 用于演示和作品集展示

---

## 示例图片

下面这些图是基于当前仓库风格生成的 README 示例图，适合直接放在文档、仓库首页或方案说明中。

### 1. System Blueprint 总览图

![System Blueprint 总览图](./images/system-blueprint-overview.svg)

### 2. Runtime Flow 运行流程图

![Runtime Flow 运行流程图](./images/system-blueprint-runtime-flow.svg)

### 3. Memory / Recall 流程图

![Memory / Recall 流程图](./images/system-blueprint-memory-recall.svg)

### 4. Deployment Topology 拓扑图

![Deployment Topology 拓扑图](./images/system-blueprint-deployment-topology.svg)

### 5. Before / After 蓝图对比图

![Before / After 蓝图对比图](./images/system-blueprint-before-after.svg)

---

## 兼容性说明

这个项目追求的是：

> 尽量贴近大多数 Agent 都能接受的“公共 skill 结构”

而不是只为某一个闭源平台定制。

### 兼容得比较好的场景

- 支持 `SKILL.md` 的 Codex 类技能系统
- 支持 `SKILL.md + assets/` 的 Claude 风格技能系统
- 支持同类轻量技能结构的 OpenClaw 风格系统

### 需要明确的边界

目前并不存在一个“所有 Agent 通吃”的全球统一 Skill 标准。

所以这个仓库采用的是：

- `SKILL.md` 作为通用核心
- `assets/template.html` 作为通用资源
- `agents/openai.yaml` 作为 Codex / OpenAI 方向的增强元数据

也就是说：

- 对大多数支持 `SKILL.md` 的 Agent，它可以比较自然地适配
- 对只认自己私有插件协议的 Agent，可能还需要你额外包一层适配器

---

## 仓库结构

```text
system-blueprint/
├── README.md
├── SKILL.md
├── agents/
│   └── openai.yaml
├── scripts/
│   └── export_diagram.py
└── assets/
    └── template.html
```

### 各文件作用

- `SKILL.md`
  技能的核心说明文件，也是最重要的跨平台公共入口

- `assets/template.html`
  默认的图形输出模板，用于生成更精致的 HTML + SVG 系统图

- `scripts/export_diagram.py`
  用于把 HTML(内联 SVG) 或 SVG 导出为 PNG / JPG / JPEG

- `agents/openai.yaml`
  面向 Codex / OpenAI 风格技能系统的增强元数据
  不是所有 Agent 都需要它

---

## 安装方式

## 1. 在 Codex 中使用

把整个目录复制到你的 Codex skills 目录：

```bash
~/.codex/skills/system-blueprint/
```

然后重启 Codex。

之后可以这样触发：

```text
使用 system-blueprint skill 为这个项目生成系统架构图。
```

或者：

```text
使用 system-blueprint，把这个 Mermaid 图升级成更精美的 HTML 架构图。
```

## 2. 在 Claude / Claude Code 风格技能系统中使用

如果你的环境支持目录形式的 skill，就直接导入这个目录。

如果支持 zip 上传，就把整个 `system-blueprint/` 目录打包后上传。

对这类系统来说，最关键的是：

```text
system-blueprint/
├── SKILL.md
└── assets/
    └── template.html
```

## 3. 在 OpenClaw 风格技能系统中使用

如果你的运行时支持 `SKILL.md` 驱动的 skill，就可以直接导入这个目录。

如果它还要求额外 manifest 或注册文件，那就保留这个目录作为主 skill 包，在外层再补一层适配即可。

---

## 使用示例

## 从代码库生成架构图

```text
使用 system-blueprint，分析这个仓库并生成一份独立 HTML 架构图。
```

## 从文字描述生成系统蓝图

```text
使用 system-blueprint，根据下面的描述生成部署拓扑图：

- React 前端
- FastAPI 后端
- PostgreSQL
- Redis
- Qdrant
- 外部天气和地图 API
```

## 把 Mermaid 升级成更精致的图

```text
使用 system-blueprint，把这份 Mermaid 图转换成更适合展示的 HTML + SVG 图。
```

## 生成 Agent Runtime 图

```text
使用 system-blueprint，绘制这个 Agent 系统的请求流、意图路由、候选方案状态变化和 recall 流程。
```

## 更新已有图

```text
使用 system-blueprint，基于现有 HTML 系统图，补上 recall 层和 plan comparison 模块。
```

---

## 输出设计原则

这个技能在输出上有几条明确倾向。

### 优先输出 HTML + Inline SVG

原因是：

- 布局控制更强
- 更适合做精美展示
- 分享方便
- 运行依赖少

### 尽量保持文件自包含

默认希望生成的文件：

- CSS 内联
- SVG 内联
- 尽量不依赖 JS
- 尽量不依赖外部运行时资源

### 用语义化颜色区分角色

默认建议至少区分：

- 客户端 / 入口层
- 应用 / 服务层
- 数据 / 存储层
- 基础设施 / 外部系统
- 安全 / 身份系统

### 风格要技术化，而不是装饰化

目标风格是：

- 清晰
- 现代
- 专业
- 适合技术演示

而不是：

- 贴满云厂商图标
- 过度装饰
- 信息密度过高但可读性差

---

## 如何自定义

你可以从三个方向定制这个技能。

### 1. 修改视觉模板

编辑：

- [`assets/template.html`](./assets/template.html)

适合改这些内容：

- 色板
- 字体
- 卡片样式
- 节点样式
- 图例风格
- 页面整体视觉语言

### 1.5 导出常用图片格式

这个 skill 现在已经补上了导出脚本：

- [`scripts/export_diagram.py`](./scripts/export_diagram.py)

它支持：

- `SVG -> PNG / JPG`
- `HTML(内联 SVG) -> PNG / JPG`

示例：

```bash
python scripts/export_diagram.py ../images/system-blueprint-overview.svg --format png
python scripts/export_diagram.py ../../docs/travel-agent-system-blueprint.html --format png
python scripts/export_diagram.py ../../docs/travel-agent-system-blueprint.html --format jpg
```

说明：

- 当前脚本依赖 `cairosvg`
- 如果你还没安装，需要先执行：

```bash
pip install cairosvg
```

- 在 Windows 上，除了安装 `cairosvg`，还需要系统里能找到 `cairo` 动态库；如果缺少 `libcairo-2.dll`，导出会在运行时报错
- 当前仓库已经验证：
  - `README` 里的 `SVG` 示例图可以直接展示
  - `export_diagram.py` 的 `PNG / JPG` 导出逻辑已经写好
  - 但在未安装 `cairo` 运行库的 Windows 环境里，`PNG / JPG` 还不能直接导出成功

所以这个 skill 现在的完整链路可以理解成：

- `HTML`：高质量展示
- `SVG`：文档嵌入
- `PNG / JPG`：常用图片格式导出

### 2. 修改技能触发和工作流

编辑：

- [`SKILL.md`](./SKILL.md)

适合改这些内容：

- 增加触发关键词
- 修改默认输出形式
- 让 Mermaid 变成主输出而不是回退输出
- 针对特定领域做专用化，比如云架构、数据平台、Agent 系统等

### 3. 修改 Codex 元数据

编辑：

- [`agents/openai.yaml`](./agents/openai.yaml)

这部分只影响支持该元数据的运行时，不是技能本身的公共核心。

---

## 推荐使用场景

这个技能特别适合：

- README 架构图
- 内部技术文档
- RFC / 设计方案
- Agent 工作流图
- 会话 / 记忆 / recall 设计图
- 部署拓扑图
- 面试作品集
- 对外展示的技术总览图

---

## 已知限制

- 它不是一个“所有 Agent 100% 通吃”的全球统一标准
- 某些运行时依然可能要求额外适配层
- 第一版图的质量仍然依赖输入描述的质量
- 对超大系统仍然需要抽象，不应该试图画出每一个实现细节
- PNG / JPG 导出目前依赖 `cairosvg`

---

## 建议的 GitHub Topics

如果你准备公开发布仓库，这些 topics 比较合适：

- `ai-agents`
- `skills`
- `architecture-diagram`
- `system-design`
- `svg`
- `html`
- `technical-diagram`
- `agent-tools`

---

## GitHub 仓库描述建议

你现在建远程仓库时，简介建议直接用下面这些中文版本。

### 版本 1：最稳

一个面向 AI Agent 的通用技能包，用于生成精美的系统蓝图、架构图与运行时流程图。

### 版本 2：强调跨代理

一个可适配 Codex、Claude 风格 Skills 和 OpenClaw 的通用系统蓝图技能包。

### 版本 3：强调输出形式

一个将代码库和系统说明转换为高质量 HTML/SVG 架构图的通用 Agent Skill。

如果你想最稳妥，我建议直接用 **版本 1**。

---

## License

正式公开前建议补一个开源许可证。

如果你希望：

- 最容易复用
- 最方便别人 fork 和二次开发

通常可以直接使用 `MIT License`。
