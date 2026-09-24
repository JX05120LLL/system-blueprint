import type { Page } from 'playwright';
import { InputError } from './common';

export async function inspectHtml(page: Page, html: string) {
  // The policy appears before any untrusted markup. Disabled JS also prevents inline event handlers.
  await page.setContent(`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' data:; img-src data:; font-src data:; script-src 'none'; base-uri 'none'">${html}`, { waitUntil: 'load' });
  return page.evaluate(() => {
    const version = document.querySelector('meta[name="system-flow"]')?.getAttribute('content')
      ?? document.querySelector('meta[name="system-blueprint"]')?.getAttribute('content');
    const data = document.querySelector('#blueprint-data');
    const resources: string[] = [];
    const allowed = (url: string) => !url.trim() || url.trim().startsWith('#') || /^data:/i.test(url.trim());
    const inspectCss = (css: string) => {
      for (const match of css.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/gi)) if (!allowed(match[1]!)) resources.push(match[1]!);
      for (const match of css.matchAll(/@import\s+['"]([^'"]+)['"]/gi)) if (!allowed(match[1]!)) resources.push(match[1]!);
    };
    for (const element of document.querySelectorAll('*')) {
      for (const name of ['src', 'poster', 'data', 'srcset']) {
        const value = element.getAttribute(name);
        if (value && !allowed(value)) resources.push(`${element.localName}[${name}]=${value}`);
      }
      if (['link', 'image', 'use', 'feImage'].includes(element.localName)) {
        const value = element.getAttribute('href') ?? element.getAttribute('xlink:href');
        if (value && !allowed(value)) resources.push(`${element.localName}[href]=${value}`);
      }
      if (element.localName === 'iframe' || element.localName === 'object' || element.localName === 'embed') resources.push(`不支持嵌入内容：${element.localName}`);
      if (element.localName === 'meta' && element.getAttribute('http-equiv')?.toLowerCase() === 'refresh') resources.push('meta refresh');
      for (const attr of Array.from(element.attributes)) {
        for (const match of attr.value.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/gi)) if (!allowed(match[1]!)) resources.push(match[1]!);
      }
      if ((element as HTMLElement).style) inspectCss((element as HTMLElement).style.cssText);
    }
    for (const style of document.querySelectorAll('style')) {
      inspectCss(style.textContent ?? '');
      // CSSOM expands escapes (for example u\72l); CSP already prevented fetching while parsing.
      for (const rule of Array.from(style.sheet?.cssRules ?? [])) inspectCss(rule.cssText);
    }
    return { version, hasData: !!data, resources: [...new Set(resources)], svgs: Array.from(document.querySelectorAll('svg')).filter(svg => !svg.parentElement?.closest('svg')).map((svg, index) => ({ index, label: svg.getAttribute('aria-label') ?? svg.querySelector('title')?.textContent ?? svg.id ?? '', viewBox: svg.getAttribute('viewBox') })) };
  });
}

/** Keep browser-computed CSS and SVG case, then capture at intrinsic viewBox/explicit dimensions. */
export async function prepareLegacyExport(page: Page, index: number, background?: string) {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const result = await page.evaluate(({ index, background }) => {
    const candidates = Array.from(document.querySelectorAll('svg')).filter(svg => !svg.parentElement?.closest('svg'));
    const source = candidates[index]!;
    const viewBox = source.viewBox.baseVal;
    const length = (name: string) => {
      const value = source.getAttribute(name);
      if (!value || /%|auto/.test(value)) return undefined;
      const animated = name === 'width' ? source.width : source.height;
      return animated.baseVal.value || undefined;
    };
    let width = length('width'); let height = length('height');
    if (!width && height && viewBox.width > 0 && viewBox.height > 0) width = height * viewBox.width / viewBox.height;
    if (!height && width && viewBox.width > 0 && viewBox.height > 0) height = width * viewBox.height / viewBox.width;
    width ??= viewBox.width || source.getBoundingClientRect().width;
    height ??= viewBox.height || source.getBoundingClientRect().height;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return { error: '选定 SVG 没有有效的 width/height 或 viewBox。' };
    width = Math.ceil(width); height = Math.ceil(height);
    const sourceRect = source.getBoundingClientRect();
    const backdrop = document.createElement('div');
    // Preserve each background's original positioning area, then scale the whole backdrop
    // from the displayed SVG size to its intrinsic export size. Flattening to one color
    // loses gradients, embedded images, percentage positions, and alpha compositing.
    const scaleX = sourceRect.width > 0 ? width / sourceRect.width : 1;
    const scaleY = sourceRect.height > 0 ? height / sourceRect.height : 1;
    backdrop.style.cssText = `all:initial;position:absolute;left:0;top:0;width:${sourceRect.width}px;height:${sourceRect.height}px;transform-origin:0 0;transform:scale(${scaleX},${scaleY});z-index:0;pointer-events:none;`;
    if (background === undefined) {
      const backgrounds: HTMLElement[] = [];
      for (let parent: Element | null = source.parentElement; parent; parent = parent.parentElement) {
        const css = getComputedStyle(parent); const rect = parent.getBoundingClientRect();
        if (css.backgroundImage === 'none' && (css.backgroundColor === 'transparent' || css.backgroundColor === 'rgba(0, 0, 0, 0)')) continue;
        const layer = document.createElement('div');
        layer.style.cssText = `all:initial;position:absolute;box-sizing:border-box;left:${rect.left - sourceRect.left}px;top:${rect.top - sourceRect.top}px;width:${rect.width}px;height:${rect.height}px;border-style:solid;border-color:transparent;pointer-events:none;`;
        for (const property of [
          'background-color', 'background-image', 'background-position', 'background-size',
          'background-repeat', 'background-origin', 'background-clip', 'background-blend-mode',
          'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
          'border-radius', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
        ]) layer.style.setProperty(property, css.getPropertyValue(property));
        backgrounds.unshift(layer);
      }
      backdrop.append(...backgrounds);
    }
    const clone = source.cloneNode(true) as SVGSVGElement;
    const originals = [source, ...source.querySelectorAll('*')];
    const copies = [clone, ...clone.querySelectorAll('*')];
    originals.forEach((original, i) => {
      const css = getComputedStyle(original);
      const target = copies[i] as SVGElement;
      for (const property of Array.from(css)) {
        // Computed local references can become absolute about:blank URLs. Keep the fragment in the cloned scene.
        const value = css.getPropertyValue(property).replace(/url\(["']?[^)"']*#([^)'" ]+)["']?\)/g, 'url(#$1)');
        target.style.setProperty(property, value);
      }
    });
    clone.querySelectorAll('script').forEach(script => script.remove());
    clone.setAttribute('width', String(width)); clone.setAttribute('height', String(height));
    clone.style.cssText += `;width:${width}px!important;height:${height}px!important;max-width:none!important;max-height:none!important;position:relative!important;z-index:1!important;transform:none!important;margin:0!important;display:block!important;`;
    const wrapper = document.createElement('div'); wrapper.id = 'blueprint-legacy-export';
    wrapper.style.cssText = `width:${width}px;height:${height}px;position:relative;isolation:isolate;overflow:hidden;background:${background ?? 'white'};`;
    wrapper.append(backdrop, clone);
    document.body.replaceChildren(wrapper);
    document.documentElement.style.cssText = 'margin:0;padding:0;min-width:0;min-height:0;';
    document.body.style.cssText = 'margin:0;padding:0;min-width:0;min-height:0;background:transparent;display:block;';
    return { elementId: wrapper.id, width, height };
  }, { index, background });
  if ('error' in result) throw new InputError(result.error);
  return result;
}
