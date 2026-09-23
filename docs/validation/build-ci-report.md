# 构建一致性与 CI 验证记录

日期：2026-09-23。范围：构建脚本、预构建产物一致性、依赖/许可证记录及 CI；不包含发布或部署。

## 已实现

- `npm run check:build` 在系统临时目录从 schema 和源码完整重建，再逐字节比较 20 个文件：两份模型生成文件、viewer、三个 CLI、12 份上游许可证、第三方说明及构建清单。检查不覆盖工作区现有预构建文件；临时目录按已核实路径清理。
- `scripts/build.mjs`、`schema.mjs`、`notices.mjs` 支持 `--output-root PATH`。构建固定仓库资源解析位置，不依赖调用 cwd。临时构建直接使用本轮生成的 Ajv validator，不能误读旧版预构建校验器。
- 检查 Node 24、仓库与 skill 版本、schema 版本、直接依赖的精确版本及实际安装版本、两份 lockfile 根元数据和全部传递依赖的锁定版本/完整性。额外核对根目录与 skill 内实际安装的 `playwright` / `playwright-core`，与 `@playwright/test` 均为 1.58.2。
- `system-blueprint/assets/build-manifest.json` 记录版本、schema SHA-256、精确构建依赖和产物 SHA-256；无机器路径或时间戳。manifest 是审计信息，安装后的生成/导出不要求访问仓库源码。
- 构建自动复制安装包的原始许可证文本，生成真实版本的 `THIRD_PARTY_NOTICES.md`。修复 Ajv 仓库短写，保证链接为 HTTPS；ELK 链接使用已核实存在的 `0.11.0` tag 与对应 build.gradle，不误用不存在的 `v0.11.0` elkjs tag。

ELK 来源核对：[elkjs 0.11.0 构建定义](https://raw.githubusercontent.com/kieler/elkjs/0.11.0/build.gradle)，其中列出 worker 引入的 Eclipse Layout Kernel 模块。许可证正文由本机锁定依赖复制，检查不在构建时访问网络。

## 本机实测

本机 Windows，Node v24.14.0。主任务已重新执行根目录与 skill 的 `npm ci` 并重新构建。

| 检查 | 结果 |
| --- | --- |
| `npm.cmd run check:build` | 退出码 0；20/20 文件一致；`differences: []`；版本 2.0.0，Playwright 1.58.2 |
| CI YAML 结构解析 | PyYAML BaseLoader 成功解析；断言双 OS、只读权限和三个触发器通过 |
| `git diff --check`（本任务文件） | 无格式错误 |

机器可读结果：`artifacts/build-consistency/report.json`。首次运行曾准确识别尚未再生的 viewer、第三方说明与缺失 manifest，退出码为 1；统一构建后复验通过。这证明检查不会先覆盖陈旧文件再声称一致。

## CI 范围与未验证项

`.github/workflows/ci.yml` 使用 Ubuntu 24.04 / Windows Server 2022 矩阵及 Node 24，权限仅 `contents: read`。顺序为锁定安装 → **先检查现有预构建文件** → 类型检查/单元测试 → 构建并再检查 → 浏览器验收 → 仓库外 skill 分发 → 示例检查。失败日志、截图和报告作为 Actions artifact 保留。

Linux 显式安装 Cairo、Noto CJK、固定 CairoSVG 2.8.2 / Pillow 11.3.0 与 Chromium 系统依赖，运行全部兼容测试。Windows 保留中文/空格路径、离线 file://、HTML 的 Python→Node 委派及其他浏览器测试，仅排除依赖系统 Cairo 的两个 Python SVG 专项；这两项由 Linux CI 覆盖。排除条件写在 workflow 中，没有删除测试或在实现中静默跳过。

首次推送后，[GitHub Actions 运行 35849383390](https://github.com/JX05120LLL/system-blueprint/actions/runs/35849383390) 在提交 `55d85de32688b32e2dc83aaddd01b156a348173e` 上完成：Ubuntu 24.04 与 Windows Server 2022 两个作业均为 success。两侧均通过预构建一致性、类型检查、单元测试、重建、浏览器验收、仓库外分发与示例检查；Linux 运行 Cairo SVG 兼容专项，Windows 运行中文路径与离线 `file://` 专项。其他浏览器与真实触控设备仍未验收。
