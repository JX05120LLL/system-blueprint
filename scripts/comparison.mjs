/** Runs in a browser DOM, with no scripts executed from the two source XML documents. */
export function composeSvg({ before, after }) {
  const ns = 'http://www.w3.org/2000/svg';
  const parse = (xml, side) => {
    const doc = new DOMParser().parseFromString(xml, 'image/svg+xml');
    if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'svg') throw new Error(`${side}: 输入不是有效 SVG`);
    if (doc.querySelector('script,foreignObject')) throw new Error(`${side}: 只支持无脚本的静态 SVG`);
    const root = doc.documentElement;
    const width = Number(root.getAttribute('width')); const height = Number(root.getAttribute('height'));
    if (![width, height].every(n => Number.isFinite(n) && n > 0)) throw new Error(`${side}: 需要明确的正数 width/height`);
    const ids = new Map([...root.querySelectorAll('[id]')].map(el => [el.id, `${side}-${el.id}`]));
    if (root.id) ids.set(root.id, `${side}-${root.id}`);
    const urls = value => value.replace(/url\(\s*['"]?#([^\s)'"]+)['"]?\s*\)/g, (_, id) => `url(#${ids.get(id) ?? id})`);
    for (const el of [root, ...root.querySelectorAll('*')]) {
      if (el.id) el.id = ids.get(el.id);
      for (const attr of [...el.attributes]) {
        let value = urls(attr.value);
        if ((attr.localName === 'href' || attr.name === 'xlink:href') && value.startsWith('#')) value = `#${ids.get(value.slice(1)) ?? value.slice(1)}`;
        el.setAttributeNS(attr.namespaceURI, attr.name, value);
      }
      if (el.localName === 'style') {
        let css = urls(el.textContent ?? '');
        for (const [oldId, nextId] of ids) css = css.replace(new RegExp(`#${oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[\\s{.:,>+~\\[])`, 'g'), `#${nextId}`);
        el.textContent = css;
      }
    }
    root.setAttribute('data-side', side); return { root, width, height };
  };
  const left = parse(before, 'before'), right = parse(after, 'after');
  if (left.root.getAttribute('data-theme') !== right.root.getAttribute('data-theme')) throw new Error('Before / After 必须使用同一主题');
  if (left.root.style.fontFamily !== right.root.style.fontFamily) throw new Error('Before / After 必须使用相同字体栈');
  const width = left.width + right.width + 96, height = Math.max(left.height, right.height) + 96;
  const root = document.createElementNS(ns, 'svg');
  for (const [name, value] of Object.entries({ xmlns: ns, width, height, viewBox: `0 0 ${width} ${height}`, role: 'img' })) root.setAttribute(name, String(value));
  root.style.fontFamily = left.root.style.fontFamily || 'Segoe UI, Microsoft YaHei, sans-serif';
  const dark = left.root.getAttribute('data-theme') === 'dark';
  const title = document.createElementNS(ns, 'title'); title.textContent = 'Before / After · 同一比例的独立图'; root.append(title);
  const background = document.createElementNS(ns, 'rect'); background.setAttribute('width', String(width)); background.setAttribute('height', String(height)); background.setAttribute('fill', dark ? '#111827' : '#F8FAFC'); root.append(background);
  for (const [item, x, name] of [[left, 32, 'Before'], [right, left.width + 64, 'After']]) {
    const label = document.createElementNS(ns, 'text'); label.setAttribute('x', String(x)); label.setAttribute('y', '38'); label.setAttribute('font-size', '20'); label.setAttribute('font-weight', '600'); label.setAttribute('fill', dark ? '#EDF2F7' : '#172033'); label.textContent = name; root.append(label);
    item.root.setAttribute('x', String(x)); item.root.setAttribute('y', '64'); root.append(document.importNode(item.root, true));
  }
  return new XMLSerializer().serializeToString(root);
}
