# System Blueprint v2 验收与示例语义核对计划

日期：2026-09-23。依据：`../superpowers/specs/2026-09-23-system-blueprint-v2-design.md`。

本报告是对方案、原始五类 SVG、旧模板、旧导出脚本、README 和 Skill 的独立只读审查结果。它定义可执行的验证策略与语义迁移边界，**不表示这些检查已经通过**。实际结果、命令退出码、浏览器与字体环境、截图和性能数据必须另记在最终验证报告中。审查期间不修改实现，不修改 `.idea/`，不 commit/push。

## 1. 验收入口与证据规则

按 M0 → M1 → M2 → M3 → M4 → M5 顺序推进。M1 必须先留下真实浏览器的新旧总览截图，再开始迁移其他示例。M4 必须完成仓库外复制测试，M5 必须执行独立 Agent 按 Skill 使用的评估。

维护者入口以根目录 `package.json` 为准，Windows 调用 `npm.cmd`：

```powershell
npm.cmd ci
npm.cmd ci --prefix system-blueprint
node system-blueprint/node_modules/playwright/cli.js install chromium
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run test:browser
npm.cmd run test:package
npm.cmd run examples:check
npm.cmd run test:performance
```

根目录已定义上述脚本名，但定义脚本不等于实现或执行成功。最终必须核对对应入口存在且可运行。

每项验收记录测试名称、执行命令、结果与产物路径；失败和未执行分开记录。单元测试证明关系语义，浏览器测试证明可见行为，实际截图证明视觉质量，文件签名与重开证明导出有效。任何一类证据不能替代其他证据。浏览器自动化等待 `window.blueprint.ready` / `whenIdle()`，不能靠固定延时假定完成。

保留的原始基线：

- `tests/fixtures/legacy/template.html` 与 `export_v1.py`。
- `tests/fixtures/legacy/system-blueprint-{overview,runtime-flow,memory-recall,deployment-topology,before-after}.svg`。
- 原设计记录的 `viewBox → viewbox` 导出错误、长文本溢出、Memory 子节点越界。

## 2. V01–V22 可执行矩阵

表中“精确比较”优先比较稳定原始 ID 集合，不依赖 DOM 顺序或截图颜色猜测语义。测试可组合 fixture，但必须保留各项可定位断言。

| 编号 | 最小输入 / 动作 | 必须断言 | 验证层与证据 |
| --- | --- | --- | --- |
| V01 | 单个 process，无边无组；初次 ready、适应画布、导出 | scale、平移及 SVG 尺寸有限且为正；节点可读；无除零；静态产物含该节点 | 单元边界 + 浏览器 + 独立 SVG/PNG |
| V02 | 中文标题、无空格英文长标识符、两行 summary；另造超过 2 行标题 / summary 与 3 行边标签 | 先测量再布局；字号不变；合法文本几何包含于形状；超限有字段/ID 诊断而非缩小、裁切或省略号；中文按字符、英文优先按词换行 | 浏览器实际字体 `getBBox()`；合法/拒绝截图；长内容诊断 |
| V03 | start → decision；“通过”到执行，“不通过”到错误；执行到 end | decision 流程出口数为 2；全部原始边与箭头存在；两条件在画布及静态导出可见；无默认补写条件 | 校验 + SVG DOM / 导出文字与 marker + 截图 |
| V04 | 主流程 A→B→C、异常 B→E、反馈 C→A、自环 C→C | 不因有环拒绝；自环可见；上下游 visited 终止；结果精确符合有向可达集合；无重复边/节点；箭头不进入文字区 | 单元精确集合 + 浏览器状态和完整 SVG |
| V05 | 父组 P、子组 C、P 直接成员、C 成员；先折叠 C，再折叠/展开 P，重复操作 | P 折叠后 C 隐藏；P 展开后 C 仍折叠；原始 JSON 不变；隐藏选中节点转为 P；隐藏 DOM 不残留焦点；Enter/展开按钮可用且 `aria-expanded` 正确 | 投影单元 + 鼠标/键盘浏览器 |
| V06 | 组内两个端点各以“成功”和“失败”连接同一外部节点，再折叠；另加完全相同条件边 | 不同标签仍为两条可见边；只有端点/方向/kind/label 完全相同才聚合；详情列出完整 `originalEdgeIds` 与原始关系；反向及无向边不能误合并 | 投影精确断言 + 边详情浏览器 |
| V07 | 布局未完成时连续折叠/展开/切换浅深主题 20 次；末次状态确定；注入一次布局失败 | 同时最多一个布局运行；仅最新 revision 提交；最终图/主题/折叠集合与最后操作一致；`whenIdle` 收敛；失败有明确可恢复说明，无空白死等 | 调度单元 + 浏览器快速操作与错误路径 |
| V08 | 先折叠、选中、上下游高亮，再缩放和平移到局部，然后静态导出 | SVG/PNG/JPEG 为全展开完整范围；无选中/淡化样式、无工具栏、无视角 transform；调用前后阅读器选择/主题/缩放/折叠不变；条件完整 | 独立导出 API + CLI + 完整文件截图 |
| V09 | title/node/group/details/source.path 包含 `</script>`、HTML、事件属性与网络 URL 字面文本 | JSON script 不能被闭合；全部按文本显示；没有新增可执行 script/元素；页面 sentinel 不变；除主 file URL 外无资源请求 | 生成器字符串断言 + 浏览器请求/脚本哨兵 |
| V10 | 中文与空格路径；输出目录不存在；输出已存在；错误模型写入旧文件路径 | 正确生成与导出；新入口无 `--overwrite` 返回 2 且旧文件哈希不变；显式覆盖成功；错误模型不能留下半文件；临时文件完成后替换；旧 Python 入口保留原覆盖行为 | CLI 子进程退出码 + 前后 SHA-256 |
| V11 | 缺端点、node/group ID 相撞、重复 edge ID、缺组、组循环、三层组、空组、不支持 schema、未知字段、断裂/重复主路径 | 每种错误为非零退出且含具体 JSON pointer、稳定 code、相关 ID；不返回半合法模型；警告不伪装错误；结构/语义均在 generate 写入前执行 | 参数化单元 + validate/generate CLI |
| V12 | 101 节点、301 边、21 组；JSON 超 2 MiB；details 超 8000；scale 越界/NaN；位图边长 >16000 或像素 >40000000 | 明确拒绝并建议减 scale/拆图；不删数据、不裁切、不输出部分文件；合法边界也测试；SVG 不错误套用位图 scale | 校验 + CLI 限额与文件不存在断言 |
| V13 | 将 `system-blueprint/` 复制至仓库外中文空格目录；去掉复制来的 node_modules，cwd 用另一临时目录 | 仅 Node 能 validate/generate；从复制目录 lockfile 安装 Playwright 后能导出；依赖解析来自复制 skill；无根 src/node_modules、cwd 相对资源依赖；浏览器可用 | `test:package` 日志、复制路径、产物 |
| V14 | context 断网且 route 阻断所有网络，`file://` 打开新 HTML | ready 成功；缩放、平移、详情、上/下游、两层折叠、主题与 SVG 下载正常；网络请求数为 0；复制/移动单文件后仍成立；不依赖相邻资源 | 离线浏览器完整流程 + 网络列表 |
| V15 | 自动导出 SVG/PNG/JPEG；新 context 直接打开 SVG；按魔数解析位图 | SVG 有 xmlns/width/height/大小写正确 viewBox、字体栈/背景/marker/样式，无 script/外链/foreignObject；PNG 签名正确；JPEG 为 JPEG 且不透明背景；像素尺寸等于导出宽高 × scale 的约定取整；扩展名与 format 冲突时报错 | SVG XML + 浏览器重开 + 位图头/像素检查 |
| V16 | 375×812；全程 Tab/Enter/Escape；打开详情、切主题/分组 | 全部主要节点与控件可达；Escape 关闭详情/高亮并回焦点；底部详情可关闭；toolbar/body 无横向溢出；面板滚动不缩放画布；首屏桌面画布≥70%可用内容高度 | 键盘/触屏浏览器 + 桌面/窄屏截图 |
| V17 | 旧模板 HTML、旧 SVG、多 SVG HTML、带页面 script 的 legacy、自包含缺失/远程资源 legacy | 旧模板不再因 viewBox 大小写失败；CSS/继承字体/背景按浏览器渲染；legacy 页面脚本不执行；网络被阻断；单 SVG 成功，多 SVG 缺 index 明确列选择，合法 index 成功，越界失败；legacy `--format svg` 明确拒绝；旧 SVG 沿 CairoSVG/Pillow 路径 | Python/Node CLI + 原错误回归 + 真实位图 |
| V18 | 五类六个模型与六份 HTML，五张既有 README SVG 路径 | 按第 3 节逐项内容核对；每份有 JSON/HTML/静态产物；桌面与窄屏、浅色和关键深色状态逐张视觉查看；全展开、关系、条件和 source/evidence 真实；不以更新快照视为通过 | `examples:check` + 内容核对表 + 人工截图审查 |
| V19 | decision 及两条不同条件边全部在组内；组只有无条件出口；折叠 | 摘要包含隐藏判断/条件数量和展开提示；详情列全部隐藏条件；不能把摘要表现为无条件步骤；展开及导出恢复全部原始条件 | 投影计数 + 详情/导出浏览器 |
| V20 | decision 有 1 control + 1 data + 1 dependency 出口，另造 2 合法 control；混合无向边 | 前者因仅一个流程出口失败；data/dependency 不凑分支数；control/exception/feedback `directed:false` 拒绝；flow 高亮只走流程边，overview/deployment 走全部有向边；无向边仅在直接关系列表中出现 | 校验/遍历精确 ID 单元 + view 切换浏览器 |
| V21 | 375 px 展示一张合法长流程，fit 比例小于 25%；连续点放大、滚轮再 fit | fit 保留完整范围且提示总览比例；放大从当前比例连续增长，无直接跳到 25%；达到25%后恢复正常下限；只有再次 fit 可进入更小比例；内容可通过平移和放大访问 | 浏览器 transform 序列 + 窄屏截图 |
| V22 | before/after 两 SVG 使用相同 marker/gradient ID，尺寸/长宽比不同 | 合成后 ID 唯一；所有 url(#...)/href/xlink:href 引用各侧正确；字号/缩放比例相同，不各缩到同宽；顶部对齐、最大高度留白、标题及边界完整；背景/主题一致 | compose 单元/XML + 独立打开 + 合成位图 |

### 2.1 浏览器几何检查

- 对文字逐项取真实 `getBBox()`，比较对应形状内部可用区域；菱形按内接文本区域判断，不能仅与外接矩形比较。
- 节点外接矩形不重叠；子节点/子组被父组包含并避开标题区；边折点和标签位于导出边界内。
- 箭头端点落在真实图形边界，不能因为矩形检查通过而穿入菱形、胶囊或 store 文本。
- 对跨层复合图检查组局部坐标累积，不能只检查顶层连线；包含祖孙组间连线、自环、回边。
- 边穿节点/遮文字是错误，普通线路相交或过长是质量警告。保留这一区别，避免以“ELK 已布局”跳过审查。

### 2.2 性能记录方式

记录 CPU/OS、Node、Chromium/Playwright 精确版本、字体栈实际可用情况。不要混入 npm 安装、Chromium 启动或 CLI 进程启动时间后仍命名为“脚本启动到 ready”。首次 ready 从页面运行时代码开始计时至 Promise 完成，另行报告端到端 CLI 耗时。

| 样本 | 次数 / 指标 | 方案目标 | 必须保留的原始数据 |
| --- | --- | --- | --- |
| 30 节点、45 边、3 组标准图 | ready 10 次；未压缩 HTML bytes | p95≤1.5秒；≤3MiB | 10 个耗时、分位数算法、字节数、节点边组数、fixture 路径 |
| 同一标准图 | 折叠/展开 20 次 | p95≤500ms | 20 个耗时；每次最终 revision 和折叠集合 |
| 100 节点、300 边、20 组合规图 | ready、导出、折叠；长任务及交互延迟 | 全量正确，无数据丢失 | 实際原始/可见数量、耗时、longtask 分布、阻塞记录 |
| 已就绪图 | 连续 zoom/pan | 不重新运行 ELK，无明显停顿 | 布局调用计数前后值、Performance trace、最长交互延迟 |

性能超目标时真实记“不达标”，并定位来源。不能用简单示例代替规定样本，也不能在合法规模冻结时只加 loading 提示便宣告满足。若采用 Blob Worker，重跑 file:// 离线和分发测试。

## 3. 五类原始示例的语义台账

以下按 `tests/fixtures/legacy` 原文件逐一读取。旧 SVG 没有方向箭头，只有路径。新方向来自明确的流程文字或标注为 assumed 的补充解释，不能把图形线段误称为运行代码证据。示例是概念表达，不是实际服务部署的证据。

### 3.1 System Overview

原节点：User、Prompt UI、SKILL.md、Template、Renderer、HTML、SVG。另有三个 Example Views 节点：System Overview、Runtime Flow、Memory / Recall。原分区为 Client / Request Layer、Skill Runtime、Output Layer、Example Views。三条路径仅连接前三区以及 Skill Runtime 到 Example Views。

方案已批准重新组织为“输入材料 → Agent 按 Skill 建模与绘制 → HTML / SVG → 按需位图导出”。因此：

- 合并 User / Prompt UI，详情保留代码仓库、文档、Mermaid 和自然语言输入。
- SKILL.md 的触发/流程/契约、模板与绘制职责放入生成节点详情；源数据 JSON 的校验与留存需在 v2 图或详情说明。
- 原 Renderer 只是概念角色；不能迁移成一个已经存在的服务器。若呈现 v2 设计架构则标题明确注明设计。
- HTML 与 SVG 必须仍被区分；PNG/JPEG 是按需导出，不能误画成阅读器需要在线服务。
- Example Views 转示例索引可从主画布退出，须仍在 README 提供链接。

### 3.2 Runtime Flow

原图共有 13 节点、12 条顺序线：

1. User Prompt → Skill Trigger → Scope Decision → Output Mode。
2. Model Extraction → System Simplification → Visual Grammar。
3. Template Composition → SVG Rendering → Self-contained File。
4. README / Docs → Feedback Loop → Iterated Output。

相邻阶段由折线路径连接。原文字涵盖输入来源、图类型、HTML/SVG 优先、用户要求 Mermaid 时尊重格式、节点/组/边界/流建模、内容简化、语义视觉、文件自包含和反馈调整。

迁移注意：

- 原名 Scope Decision 没有显式条件分支，不能仅按名字变成缺少两个出口的 decision；可作为“选择图类型”process，或按真实文字补完整条件并记录细化。
- 原图只有名为 Feedback Loop 的节点，没有画回边。v2 应据“反馈调整”含义表达回到建模/修改阶段，并以“需要修改/确认交付”等条件说明；这属于语义显式化，不是原 SVG 已有箭头的恢复。
- “模板注入 Hero/legend/cards”属于 v1 实现，v2 改成生成自包含阅读器；保留先建模后渲染的顺序与重新生成职责。
- visual grammar 不再描述每类铺大色块；新版采用浅色工程风、方向与形状表达。

### 3.3 Memory / Recall

原分区与节点：

- Current Session：Message、Session Summary。
- Recall & Decision Layer：Intent Router（continue / new / compare / recall）、Context Builder、Recall Policy（Explicit request or strong match）。
- History Sources：Trips、Plan Options、Session Summaries、Messages；说明为有序检索历史持久记录。
- Memory Types：Session Memory（最近轮次与当前摘要）、Plan Memory（当前选项及确认约束）、User Preferences（稳定偏好与可复用决策）、Recall（按需）。

原图表达当前会话为基础，仅在相关时召回历史和偏好。五条无箭头路径连接分区，不足以证明精确的检索顺序、查询实现或失败策略。

迁移需要显式出现“用户明确要求或强匹配”的检索条件和“不检索/保持当前上下文”路径，两者最终进入上下文组装。检索结果去向清楚；历史源四类与三种记忆含义可放详情，但不可无说明删除。若补充“未命中/检索失败”分支，将其标为本示例的 assumed 行为，不伪造现有系统实现。原 Recall Policy 底边为 458，父容器底边为 432，是明确的 26 单位越界回归点。

### 3.4 Deployment Topology

原节点与边界：

- Users：Browser / Mobile / Internal tools。
- Cloud Edge & Application Zone：CDN / WAF（Public edge）、FastAPI（App API）、Agent Core（Routing + tools）。
- Data & Memory Zone：PostgreSQL（Sessions / plans / trips）、Redis（Cache / hot state）、Qdrant（Knowledge / recall）。
- External Services：Maps API、Weather API、Search、Messaging / TTS。

原五条线：Users 到应用区边界、CDN/WAF 到 FastAPI、FastAPI 到 Agent Core、Agent Core 到数据区边界、Agent Core 到外部区边界。原始线没有分别连到 PostgreSQL/Redis/Qdrant 或各个外部服务，因此新版补足这些具体端点连接时用 dependency/data 及明确 label，并标 assumed；不要将线位置认定为已证实调用。组名保留部署位置含义，不能仅按颜色分组。跨组和跨层坐标是本示例的关键验收点。

### 3.5 Before / After

原 Before：Frontend、API、Database。原 After：Client Layer（Browser / Mobile / Prompt UI）、Application Layer（API 与 LLM）、Data & Memory（Plans / trips / summaries / preferences / recall）。Before 的 API 垂直线没有接到 Database 的实际外框，且左右节点粒度不一致；原图主要比较视觉风格，不足以说明等价架构演进。

v2 要求两份独立文档、同主题同粒度，必须作最小语义修订并记录：采用共同的 Frontend / API / Database 稳定身份，保留对应关系；如仍展示 LLM 或 memory 拓展，应明确标为新增/规划，并在双方保持相同粒度，不能把新增能力包装成仅“换了配色”。如仅比较分组改进，可将 LLM 移入原始图说明详情，说明此版对比聚焦三层结构，不声称自动无损迁移。

交互交付两份 HTML；静态图由两张完整 SVG 合成。保持每侧原比例，不为等宽分别缩放。marker/gradient ID 全面加前缀，包含 style 内的 `url(#...)`、href 与 xlink:href；合成后的引用必须能够解析到本侧定义。

## 4. 方案歧义与最小处理建议

| 问题 | 最小处理与应记录内容 |
| --- | --- |
| 原方案状态仍是“未实现”，末段仍称“只写设计方案” | 保留设计历史状态；实际 M0–M5 进展、变更与验证结果写实施记录/最终报告，避免重写成当时已实现。 |
| schema 的字符串长度 vs 浏览器“两行”限制 | 字符数量防资源滥用，真实字体测量防视觉溢出，两层都要做；generate 仅校验通过不能宣称视觉通过。 |
| 节点/组 ID 全局与边 ID 唯一 | 节点和组共享空间；edge ID 独立但文档内唯一。DOM 使用安全内部 ID，不能直接拼业务 ID 到选择器/markup。 |
| flow 自环与 decision 条件 | 自环合法，但 decision 仍须两个可区分的有向流程出口。回边不等于“忽略所有分支规则”。 |
| 适应画布低于25% vs 常规最小25% | fit 可临时降低 zoom 下限，从该比例连续放大；到25%恢复常规限制，不能用 clamp 造成跳变。 |
| 深色布局与导出“当前主题” | 两主题共享几何；切主题不应变化内容粒度。独立导出读取当前主题但不继承选中/折叠/视角；CLI 默认沿文档主题。 |
| “SVG/PNG/JPEG导出”容易被误解为任何输入均可转 | v2 HTML 支持三格式；legacy HTML 只兼容位图；legacy SVG 保留 Python CairoSVG/Pillow 位图路径。帮助与错误中明确边界。 |
| legacy 保留 CSS 与禁脚本 | 用禁脚本 context 加载静态 DOM，等待字体，阻断外部请求。不能为了取 CSS 开启用户脚本，也不能 BeautifulSoup 重写 SVG 后丢 CSS。 |
| legacy SVG 全边界与 HTML CSS 宽高 | 从 SVG 的 viewBox/自然内容尺寸规划截图区域；不让 1366px 视口缩窄后的显示尺寸成为默认导出分辨率；过滤器越界范围若有局限如实记录。 |
| HTML 新依赖与 Python 顶层 import | Python HTML 分支应先路由 Node，不要求提前加载 CairoSVG/BeautifulSoup；只有旧 SVG 路径再加载相应依赖。缺 Node/Playwright/Chromium 分别清晰报错。 |
| 新旧覆盖行为不同 | Node 新入口默认不覆盖，Python 兼容旧入口默认覆盖；wrapper 需显式传递授权覆盖参数，不把新默认泄露成旧行为回归。 |
| JPEG 按扩展名保存旧 bug | 必须显式指定编码格式或严格检查后缀；不能因输出名 `.png` 把 `--format jpg` 实际保存为 PNG。 |
| 暂停线程与超时 | 主线程 ELK 不可由普通 timer 安全中断；性能报告测真实长任务，必要时改 Blob Worker，不能把 timeout 包装当成可取消布局。 |
| Before/After “五类”与模型数 | 五类预览需六个单图 JSON/HTML（比较为两份）；原 README 仍保留五个静态 SVG 路径。 |
| 分发验证“根目录不可访问” | 至少复制至仓库外、独立 cwd、无根源码/依赖解析；若环境无法隔离文件系统访问，明确这是依赖闭合验证而非 OS 级不可访问证明。 |
| 文档命令路径 | 包内脚本通过自身位置解析资源；README 使用仓库相对命令时注明 cwd，安装后用已安装 skill 的绝对/明确路径。 |

## 5. 交付前审查门槛

- 完整运行规定检查后，再检查 `git diff --check` 与最终 diff；保留用户原改动和 `.idea/`，不 commit/push。
- README、Skill、默认提示词、references、CLI help 的主题默认、交互能力、依赖与覆盖策略一致；去掉 v1 “默认深色/尽量不用 JS/HTML 用 BeautifulSoup+CairoSVG 导出”的过时说法。
- 单文件 HTML 内没有 CDN、网络字体、相邻资源读取、外置 Worker；内嵌数据保留原始条件/ID/来源，详情也算实际交付内容。
- 预构建 bundle/schema 与源码一致；根与 skill 的 Playwright 版本一致；许可证/精确依赖清单随 skill 分发。
- 新旧比较截图使用实际浏览器、同视口；五类迁移逐图检查；静态图在独立文件中重开，不能仅截阅读器证明导出。
- 最终报告逐项写 V01–V22 的通过/失败/未验证状态；性能表并列方案目标与本机实测；给出 JSON、HTML、SVG、位图、截图、报告的可点击路径。
- 独立 Agent 使用评估只提供真实需求与原始材料，让其仅依 skill 完成生成、校验、导出、交付；保留输入提示与实际结果，不把已知答案或缺陷偷偷写入评估提示。
