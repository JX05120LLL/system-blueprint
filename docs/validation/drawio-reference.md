# drawio-skill 参考记录

用户于实施中补充参考：https://github.com/Agents365-ai/drawio-skill 。本次阅读远程 main 的 README、skills/drawio-skill/SKILL.md、references/autolayout.md、diagram-types.md、xml-authoring.md、diagram-ir.md 与 scripts/validate.py。上游可变，以下是本次阅读决策，不是对其功能的本机验证。

## 纳入当前方案

- 主 Skill 保持精简，以请求类型路由到具体参考；结构语义与视觉主题分开。
- 稳定语义 ID 与来源信息保留；展示质量不能替代关系正确性。
- 结构校验、真实渲染、几何检查和截图审查组合验证。重点检查标签裁切、边穿节点、重叠连线、悬空端点。
- 节点/组详情保留说明，画布突出主要关系；无脚本查看提供文本替代及独立 SVG。
- 文档提供可直接运行的命令，并分别说明工具依赖与降级后的验证边界。

## 与 v2 目标不同的部分

- 不引入 draw.io / Graphviz / 图形编辑器依赖，继续 TypeScript + ELK + SVG 与离线 HTML。
- 不采用自动传递约简删边：本项目要求保留全部原始关系、条件与映射。
- 不采用按组铺多种彩色背景，使用方案已确认的浅色工程风和克制强调色。
- 不扩大到 IR 导入器、多视图工作台、MCP、PPTX、CI 架构策略或线上同步。
- 仅参考设计原则，未复制上游实现代码；若后续复用代码需保留其 MIT 许可与版权声明。

## 上游定位

- [Skill 工作流](https://github.com/Agents365-ai/drawio-skill/blob/main/skills/drawio-skill/SKILL.md)
- [自动布局与校验](https://github.com/Agents365-ai/drawio-skill/blob/main/skills/drawio-skill/references/autolayout.md)
- [结构与几何校验器](https://github.com/Agents365-ai/drawio-skill/blob/main/skills/drawio-skill/scripts/validate.py)
