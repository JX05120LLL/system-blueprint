# 在编程工具中安装 System Flow

System Flow 是一个包含 `SKILL.md`、参考资料、脚本和已构建资源的本地 Skill。下表的“支持”指这些工具的官方文档提供了读取该目录格式的方式；本仓库没有在每一种工具中完成端到端生成测试。真正执行校验和生成还需要该工具能访问文件和终端，并在执行环境中安装 Node.js 24.x。

| 编程工具 | 个人安装目录 | 当前项目安装目录 | 官方说明 |
| --- | --- | --- | --- |
| Codex | `~/.agents/skills/system-flow/` | `.agents/skills/system-flow/` | [Codex Skills](https://developers.openai.com/codex/skills) |
| Claude Code | `~/.claude/skills/system-flow/` | `.claude/skills/system-flow/` | [Claude Code Skills](https://code.claude.com/docs/en/skills) |
| Cursor | `~/.cursor/skills/system-flow/` | `.cursor/skills/system-flow/` | [Cursor Agent Skills](https://cursor.com/docs/skills) |
| GitHub Copilot（CLI / VS Code Agent 模式） | `~/.copilot/skills/system-flow/` | `.github/skills/system-flow/` | [Copilot Agent Skills](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/add-skills) |
| Gemini CLI | `~/.gemini/skills/system-flow/` | `.gemini/skills/system-flow/` | [Gemini CLI Agent Skills](https://geminicli.com/docs/cli/using-agent-skills/) |

上述 `~` 是当前用户主目录；项目目录相对于**使用这张图的仓库根目录**。Codex、Cursor、Copilot 和 Gemini CLI 也都在官方文档中列出了 `.agents/skills/` 作为可用位置，可以用这一位置在本机共享一份 Skill；Claude Code 使用 `.claude/skills/`。工具版本、工作区信任设置与云端环境会影响是否发现或执行 Skill，请在目标工具中检查。

## 复制完整目录

从 System Flow 仓库根目录运行下面的 PowerShell 示例，将 Skill 安装到 Codex 的个人目录。给其他工具安装时，将 `$skillsRoot` 换成表中的个人或项目 `skills` 目录。目标目录已存在时请先人工检查版本，示例命令不会覆盖它。

```powershell
$skillSource = (Resolve-Path -LiteralPath '.\system-flow').Path
$skillsRoot = Join-Path ([Environment]::GetFolderPath('UserProfile')) '.agents\skills'
$skillTarget = Join-Path $skillsRoot 'system-flow'
if (Test-Path -LiteralPath $skillTarget) { throw "目标目录已存在：$skillTarget" }
New-Item -ItemType Directory -Path $skillsRoot -Force | Out-Null
Copy-Item -LiteralPath $skillSource -Destination $skillTarget -Recurse
Test-Path -LiteralPath (Join-Path $skillTarget 'SKILL.md')
```

复制后应能直接找到 `system-flow/SKILL.md`、`system-flow/scripts/generate.mjs`、`system-flow/assets/viewer.js`、`system-flow/references/`、`system-flow/LICENSE` 和 `system-flow/THIRD_PARTY_NOTICES.md`，不要只复制 `SKILL.md`。目录名使用 `system-flow`，与文件中的 `name: system-flow` 一致。

## 让工具生成图

在目标编程工具中打开要分析的项目，提出类似请求：

```text
使用 system-flow Skill，核对当前仓库的主要模块、请求路径与证据来源。
先生成可修改的 .diagram.json，再校验并生成离线 HTML 和静态 SVG。
请实际检查图的方向、文字、连线与交互，并标明仍需人工确认的关系。
```

Codex 可明确提及 `$system-flow`；Claude Code 可使用 `/system-flow`；Gemini CLI 可先运行 `/skills list` 检查发现情况，必要时运行 `/skills reload`。Cursor 可在 Skills 列表检查；Copilot 在 Agent 模式中按任务描述选用 Skill。不同工具的自动触发取决于其版本和模型判断，显式点名更容易核对。

Skill 负责指导工具建立图数据，但图的生成与导出依赖随目录提供的本地脚本。安装后的命令仍是 `node <skill-dir>/scripts/validate.mjs <diagram.json>` 和 `node <skill-dir>/scripts/generate.mjs <diagram.json> --output <diagram.html>`；详细使用与导出命令见[操作说明](usage.md)。PNG/JPEG 自动导出还需在安装后的 Skill 目录运行 `npm ci` 并安装 Playwright Chromium。单文件 HTML 的阅读、详情审核和浏览器内 SVG 下载不需要登录或网络。

目前只按上述五种工具的官方安装位置编写了说明；没有列出的工具可直接调用本地 Node 脚本，但不能据此认定它们会自动发现 `SKILL.md`。云端 Agent 若未携带该目录或缺少 Node.js 24，也不能直接执行本地生成命令。
