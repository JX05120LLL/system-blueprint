import ELK from 'elkjs/lib/elk-api.js';
import type { ElkNode } from 'elkjs/lib/elk-api';
declare const __ELK_WORKER_SOURCE__: string;
let instance: InstanceType<typeof ELK> | undefined;
let failure: Promise<never> | undefined;
let worker: Worker | undefined;
let blobUrl: string | undefined;
function release() { worker?.terminate(); worker = undefined; instance = undefined; if (blobUrl) URL.revokeObjectURL(blobUrl); blobUrl = undefined; }
function initialize() {
  if (instance) return;
  if (typeof Worker === 'undefined') throw new Error('浏览器不支持 Web Worker，无法运行离线布局。请使用支持 Worker 的浏览器或独立 SVG。');
  blobUrl = URL.createObjectURL(new Blob([__ELK_WORKER_SOURCE__], { type: 'text/javascript' }));
  worker = new Worker(blobUrl);
  failure = new Promise<never>((_, reject) => worker!.addEventListener('error', event => { reject(new Error(`离线布局 Worker 失败：${event.message || '浏览器禁止运行 Blob Worker'}`)); release(); }, { once: true }));
  void failure.catch(() => {});
  worker.addEventListener('message', () => { if (blobUrl) URL.revokeObjectURL(blobUrl); blobUrl = undefined; }, { once: true });
  instance = new ELK({ workerFactory: () => worker!, algorithms: ['layered'] });
}
addEventListener('pagehide', release);
export const engine = {
  async layout<T extends ElkNode>(graph: T) {
    initialize();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([instance!.layout(graph), failure!, new Promise<never>((_, reject) => { timer = setTimeout(() => { release(); reject(new Error('布局超过 30 秒，请拆分为总览和子图后重试。')); }, 30000); })]);
    } finally { clearTimeout(timer); }
  }
};
