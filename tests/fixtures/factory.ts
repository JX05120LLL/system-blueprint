import type { DiagramDocument, DiagramEdge } from '../../src/model/types.ts';

/** Deterministic synthetic data for measured runs, without changing or pruning connections. */
export function makePerformanceDocument(nodeCount: number, edgeCount: number, groupCount: number): DiagramDocument {
  if (!Number.isInteger(nodeCount) || nodeCount < 1 || nodeCount > 100) throw new RangeError('nodeCount must be an integer in 1..100');
  if (!Number.isInteger(edgeCount) || edgeCount < 0 || edgeCount > 300) throw new RangeError('edgeCount must be an integer in 0..300');
  if (!Number.isInteger(groupCount) || groupCount < 0 || groupCount > Math.min(nodeCount, 20)) throw new RangeError('groupCount must be in 0..min(nodeCount,20)');
  const nodeId = (index: number) => `n${String(index + 1).padStart(3, '0')}`;
  const groupId = (index: number) => `g${String(index + 1).padStart(2, '0')}`;
  const edgeId = (index: number) => `e${String(index + 1).padStart(3, '0')}`;
  const chainLength = Math.min(nodeCount - 1, edgeCount);
  const edges: DiagramEdge[] = Array.from({ length: edgeCount }, (_, i) => {
    if (i < chainLength) return { id: edgeId(i), source: nodeId(i), target: nodeId(i + 1), kind: 'control', directed: true, evidenceStatus: 'confirmed' };
    const extraIndex = i - chainLength;
    const sourceIndex = extraIndex % nodeCount;
    const distance = Math.floor(extraIndex / nodeCount) + 2;
    const feedback = extraIndex % 11 === 0;
    const offset = sourceIndex + (feedback ? -distance : distance);
    const targetIndex = ((offset % nodeCount) + nodeCount) % nodeCount;
    return {
      id: edgeId(i), source: nodeId(sourceIndex), target: nodeId(targetIndex),
      kind: feedback ? 'feedback' : extraIndex % 2 === 0 ? 'data' : 'dependency',
      directed: true, evidenceStatus: 'confirmed',
      ...(feedback ? { label: '反馈' } : {}),
    };
  });
  return {
    schemaVersion: '2.0', id: `performance-${nodeCount}-${edgeCount}-${groupCount}`,
    title: `${nodeCount} 节点性能样例`, description: `确定性合成数据：${nodeCount} 个节点、${edgeCount} 条边、${groupCount} 个组；不代表真实业务系统。`,
    view: { kind: 'overview', direction: 'RIGHT', theme: 'light', primaryPath: Array.from({ length: chainLength }, (_, i) => edgeId(i)) },
    nodes: Array.from({ length: nodeCount }, (_, i) => ({
      id: nodeId(i), kind: i % 9 === 8 ? 'store' : 'process', label: `组件 ${String(i + 1).padStart(3, '0')}`,
      summary: i % 4 === 0 ? '处理请求与上下文' : '保留原始关系', evidenceStatus: 'confirmed',
      ...(groupCount > 0 ? { groupId: groupId(Math.floor(i * groupCount / nodeCount)) } : {}),
    })),
    groups: Array.from({ length: groupCount }, (_, i) => ({ id: groupId(i), label: `处理区域 ${i + 1}` })),
    edges,
  };
}
