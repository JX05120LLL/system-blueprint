# v2 性能与体积实测

2026-09-23，Windows 本机。命令：`npm run test:performance`，退出码 0。完整数列、字体与环境保存在 [results.json](../../artifacts/performance/results.json)。这是指定样本在本机的测量，不是任意图形或所有设备的性能承诺。

| 指标 | 方案目标 | 最终实测 |
| --- | --- | --- |
| 30 节点 / 45 边 / 3 组，未压缩 HTML | ≤3 MiB | 1,761,190 bytes，约 1.680 MiB |
| 同一样例首次就绪，10 次 p95 | ≤1,500 ms | 232.2 ms |
| 同一样例折叠/展开，20 次 p95 | ≤500 ms | 50.4 ms |
| 100 节点 / 300 边 / 20 组首次就绪 | 完整完成，记录阻塞 | 462.4 ms；100/300/20 全部保留 |
| 上限图折叠并恢复 | 不丢原始关系 | 折叠 249.8 ms，往返 469.3 ms；恢复 100/300/20 |
| 上限图完整 SVG | 无删减或裁切 | 204.2 ms；100 节点 / 300 边，218,701 bytes |
| 上限图主线程 Long Tasks | 记录并处理阻塞 | 本轮初始及折叠/导出阶段均未记录到 ≥50 ms 长任务 |
| 连续缩放/平移 | 不重跑 ELK | layoutRuns 前后均为 21；轨迹内最长 EventDispatch 为 2.261 ms |

首次就绪从内嵌脚本首行的 `performance.now()` 到 `blueprint.ready`，包括脚本执行、字体等待、测量、Worker 初始化、布局和 DOM 提交；不混入 Chromium 进程启动、npm 安装或下载。折叠标准样本从操作开始到 `whenIdle()`，再等待两个 animation frame，包含绘制机会。上限图操作时间记录到 DOM 提交。p95 使用排序后第 `ceil(n×0.95)` 个值；10 次样本的 p95 即最大值。

环境：Windows 10.0.26200 x64，Intel Core i7-12700H，20 逻辑 CPU，15.6 GiB RAM；Node 24.14.0，Playwright 1.58.2，Chromium 145.0.7632.6，1366×768。截图统一 `--disable-gpu`，解决本机旧 SVG 在硬件路径下截图超时的问题。字体栈为 Segoe UI / Microsoft YaHei / Noto Sans CJK SC / sans-serif；CDP 在实际节点文字上确认 Segoe UI Semibold 与 Microsoft YaHei Bold，均为本机字体，无网络字体。

## 由实测驱动的修订

最初主线程 ELK 实现虽满足标准图 p95，100/300/20 样本仍出现 204 ms 与 364 ms 主线程长任务。该阶段记录保存在 [before-worker-summary.json](../../artifacts/performance/before-worker-summary.json)。因此按方案引入内嵌 Blob Worker，而非仅增加加载提示。运行时不依赖外置 Worker 文件；Worker 错误和 30 秒超时有明确诊断，不回退到阻塞式布局。最终离线、file://、分发、浏览器交互均在此实现上重跑。

标准/上限模型由 [factory.ts](../../tests/fixtures/factory.ts) 确定性生成；图中同时含普通链、反馈、数据与依赖边，未削减连接。缩放和平移的证据同时保留 [Playwright trace](../../artifacts/performance/zoom-pan-trace.zip) 与 [Chrome Performance trace](../../artifacts/performance/zoom-pan-performance.json)。EventDispatch 耗时只说明采集的事件处理，不等于完整输入到显示延迟。

## 实际限制

- 上限样例为 34,279×1,063 的横向长图。HTML 可探索、SVG 可完整输出，但适应画布后无法直接阅读全部文字，应放大平移或按主题拆图。这是布局密度限制，不是数据丢失。
- 该上限图即使 scale=0.5，位图宽度仍超过 16,000 px，因此 PNG/JPEG 会按既定限制明确拒绝；需要拆图。未为了导出而静默裁切或绕过限额。
- HTML 体积主要来自内嵌 ELK Worker，单个标准文件约 1.68 MiB。压缩包体积不用于替代未压缩 HTML 指标。
- 10/20 次短程测量不能证明其他机器、复杂文本或所有合法拓扑均达到相同 p95；未做触控硬件、长时间压力与跨浏览器性能测试。
