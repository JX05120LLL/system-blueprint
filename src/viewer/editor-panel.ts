import type { DiagramDocument, DiagramEdge, DiagramNode } from '../model/types';
import type { Selection } from './details';
import type { DocumentEdit } from './edit';
import { formatSourceLines, parseSourceLines } from './edit';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  return element;
};
const evidenceOptions = [['', '未标记'], ['confirmed', '已证实'], ['assumed', '假设，待核实'], ['planned', '规划，尚非运行事实']] as const;
const nodeKindOptions = [['start', '开始'], ['end', '结束'], ['process', '处理'], ['decision', '判断'], ['store', '存储'], ['external', '外部'], ['fork', '分叉'], ['join', '汇合']] as const;
const edgeKindOptions = [['control', '流程'], ['data', '数据'], ['dependency', '依赖'], ['exception', '异常'], ['feedback', '反馈']] as const;

function field(form: HTMLFormElement, title: string, name: string, value: string, multiline = false) {
  const label = el('label'); label.className = 'editor-field'; label.append(el('span', title));
  const control = multiline ? el('textarea') : el('input'); control.name = name; control.value = value;
  if (control instanceof HTMLTextAreaElement) control.rows = name === 'sources' ? 3 : 4;
  if (name === 'details') control.maxLength = 8000;
  label.append(control); form.append(label);
}
function choice(form: HTMLFormElement, title: string, name: string, value: string, options: readonly (readonly [string, string])[]) {
  const label = el('label'); label.className = 'editor-field'; label.append(el('span', title));
  const select = el('select'); select.name = name;
  for (const [key, text] of options) { const option = el('option', text); option.value = key; select.append(option); }
  select.value = value; label.append(select); form.append(label);
}
function value(form: HTMLFormElement, name: string): string {
  return (form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
}
const optional = (text: string): string | undefined => text.trim() || undefined;

/** A property inspector for the original graph object, including an edge hidden by a folded group. */
export function showEditor(panel: HTMLElement, doc: DiagramDocument, target: Selection, actions: { cancel: () => void; save: (edit: DocumentEdit) => Promise<string | undefined> }) {
  const object = target.kind === 'node' ? doc.nodes.find(item => item.id === target.id) : target.kind === 'edge' ? doc.edges.find(item => item.id === target.id) : doc.groups.find(item => item.id === target.id);
  if (!object) return;
  panel.replaceChildren(); panel.hidden = false;
  panel.dataset.editKind = target.kind; panel.dataset.editId = target.id;
  delete panel.dataset.dirty;
  const cancelTop = el('button', '取消'); cancelTop.className = 'close'; cancelTop.onclick = actions.cancel; panel.append(cancelTop);
  panel.append(el('h2', `编辑${target.kind === 'node' ? '节点' : target.kind === 'edge' ? '连接' : '分组'}详情`));
  const form = el('form'); form.noValidate = true;
  form.addEventListener('input', () => { panel.dataset.dirty = 'true'; });
  if (target.kind === 'node') {
    const node = object as DiagramNode;
    field(form, '名称', 'label', node.label);
    field(form, '摘要', 'summary', node.summary ?? '');
    field(form, '说明', 'details', node.details ?? '', true);
    choice(form, '节点类型', 'kind', node.kind, nodeKindOptions);
    choice(form, '所属分组', 'groupId', node.groupId ?? '', [['', '无'], ...doc.groups.map(group => [group.id, group.label] as const)]);
    choice(form, '信息依据', 'evidenceStatus', node.evidenceStatus ?? '', evidenceOptions);
    field(form, '来源', 'sources', formatSourceLines(node.sources), true);
  } else if (target.kind === 'edge') {
    const edge = object as DiagramEdge;
    const nodes = doc.nodes.map(node => [node.id, `${node.label} (${node.id})`] as const);
    choice(form, '来源节点', 'source', edge.source, nodes);
    choice(form, '目标节点', 'target', edge.target, nodes);
    field(form, '条件 / 标签', 'label', edge.label ?? '');
    field(form, '说明', 'details', edge.details ?? '', true);
    choice(form, '关系类型', 'kind', edge.kind, edgeKindOptions);
    const label = el('label'); label.className = 'editor-checkbox';
    const checkbox = el('input'); checkbox.type = 'checkbox'; checkbox.name = 'directed'; checkbox.checked = edge.directed;
    label.append(checkbox, el('span', '有方向')); form.append(label);
    choice(form, '信息依据', 'evidenceStatus', edge.evidenceStatus ?? '', evidenceOptions);
    field(form, '来源', 'sources', formatSourceLines(edge.sources), true);
  } else {
    const group = object as DiagramDocument['groups'][number];
    field(form, '名称', 'label', group.label);
    field(form, '说明', 'details', group.details ?? '', true);
    choice(form, '父分组', 'parentId', group.parentId ?? '', [['', '无'], ...doc.groups.filter(item => item.id !== group.id).map(item => [item.id, item.label] as const)]);
  }
  if (target.kind !== 'group') form.append(el('p', '来源每行一个路径；需要行号或保留特殊字符时写成 "路径"#L12。'));
  const error = el('p'); error.className = 'field-error'; error.setAttribute('role', 'alert'); error.hidden = true; form.append(error);
  const buttons = el('div'); buttons.className = 'form-actions';
  const save = el('button', '保存修改'); save.type = 'submit';
  const cancel = el('button', '取消'); cancel.type = 'button'; cancel.onclick = actions.cancel;
  buttons.append(save, cancel); form.append(buttons);
  let saving = false;
  form.onsubmit = async event => {
    event.preventDefault();
    if (saving) return;
    saving = true;
    const controls = [cancelTop, ...form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement>('input,select,textarea,button')];
    controls.forEach(control => { control.disabled = true; });
    error.hidden = true;
    try {
      let edit: DocumentEdit;
      if (target.kind === 'node') {
        const node = object as DiagramNode;
        const patch: Partial<Omit<DiagramNode, 'id'>> = {};
        if (value(form, 'label') !== node.label) patch.label = value(form, 'label').trim();
        if (value(form, 'summary') !== (node.summary ?? '')) patch.summary = optional(value(form, 'summary'));
        if (value(form, 'details') !== (node.details ?? '')) patch.details = optional(value(form, 'details'));
        if (value(form, 'kind') !== node.kind) patch.kind = value(form, 'kind') as DiagramNode['kind'];
        if (value(form, 'groupId') !== (node.groupId ?? '')) patch.groupId = optional(value(form, 'groupId'));
        if (value(form, 'evidenceStatus') !== (node.evidenceStatus ?? '')) patch.evidenceStatus = optional(value(form, 'evidenceStatus')) as DiagramNode['evidenceStatus'];
        if (value(form, 'sources') !== formatSourceLines(node.sources)) patch.sources = parseSourceLines(value(form, 'sources'));
        edit = { type: 'node', id: target.id, patch };
      } else if (target.kind === 'edge') {
        const edge = object as DiagramEdge;
        const patch: Partial<Omit<DiagramEdge, 'id'>> = {};
        if (value(form, 'source') !== edge.source) patch.source = value(form, 'source');
        if (value(form, 'target') !== edge.target) patch.target = value(form, 'target');
        if (value(form, 'label') !== (edge.label ?? '')) patch.label = optional(value(form, 'label'));
        if (value(form, 'details') !== (edge.details ?? '')) patch.details = optional(value(form, 'details'));
        if (value(form, 'kind') !== edge.kind) patch.kind = value(form, 'kind') as DiagramEdge['kind'];
        const directed = (form.elements.namedItem('directed') as HTMLInputElement).checked;
        if (directed !== edge.directed) patch.directed = directed;
        if (value(form, 'evidenceStatus') !== (edge.evidenceStatus ?? '')) patch.evidenceStatus = optional(value(form, 'evidenceStatus')) as DiagramEdge['evidenceStatus'];
        if (value(form, 'sources') !== formatSourceLines(edge.sources)) patch.sources = parseSourceLines(value(form, 'sources'));
        edit = { type: 'edge', id: target.id, patch };
      } else {
        const group = object as DiagramDocument['groups'][number];
        const patch: Partial<Omit<typeof group, 'id'>> = {};
        if (value(form, 'label') !== group.label) patch.label = value(form, 'label').trim();
        if (value(form, 'details') !== (group.details ?? '')) patch.details = optional(value(form, 'details'));
        if (value(form, 'parentId') !== (group.parentId ?? '')) patch.parentId = optional(value(form, 'parentId'));
        edit = { type: 'group', id: target.id, patch };
      }
      const message = await actions.save(edit);
      if (message) { error.textContent = message; error.hidden = false; }
    } catch (failure) { error.textContent = failure instanceof Error ? failure.message : String(failure); error.hidden = false; }
    finally { controls.forEach(control => { control.disabled = false; }); saving = false; }
  };
  panel.append(form);
  (form.querySelector('input,textarea,select') as HTMLElement | null)?.focus({ preventScroll: true });
}
