#!/usr/bin/env node

// src/cli/export.ts
import { createRequire } from "node:module";
import { dirname as dirname2, resolve as resolve3, relative, isAbsolute } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { realpath } from "node:fs/promises";

// src/cli/common.ts
import { open, mkdir, rename, link, unlink, access } from "node:fs/promises";
import { dirname, resolve, extname } from "node:path";
import { randomUUID } from "node:crypto";

// src/model/validator.generated.js
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var require_ucs2length = __commonJS({
  "node_modules/ajv/dist/runtime/ucs2length.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function ucs2length(str) {
      const len = str.length;
      let length = 0;
      let pos = 0;
      let value;
      while (pos < len) {
        length++;
        value = str.charCodeAt(pos++);
        if (value >= 55296 && value <= 56319 && pos < len) {
          value = str.charCodeAt(pos);
          if ((value & 64512) === 56320)
            pos++;
        }
      }
      return length;
    }
    exports.default = ucs2length;
    ucs2length.code = 'require("ajv/dist/runtime/ucs2length").default';
  }
});
var require_fast_deep_equal = __commonJS({
  "node_modules/fast-deep-equal/index.js"(exports, module) {
    "use strict";
    module.exports = function equal(a, b) {
      if (a === b) return true;
      if (a && b && typeof a == "object" && typeof b == "object") {
        if (a.constructor !== b.constructor) return false;
        var length, i, keys;
        if (Array.isArray(a)) {
          length = a.length;
          if (length != b.length) return false;
          for (i = length; i-- !== 0; )
            if (!equal(a[i], b[i])) return false;
          return true;
        }
        if (a.constructor === RegExp) return a.source === b.source && a.flags === b.flags;
        if (a.valueOf !== Object.prototype.valueOf) return a.valueOf() === b.valueOf();
        if (a.toString !== Object.prototype.toString) return a.toString() === b.toString();
        keys = Object.keys(a);
        length = keys.length;
        if (length !== Object.keys(b).length) return false;
        for (i = length; i-- !== 0; )
          if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;
        for (i = length; i-- !== 0; ) {
          var key = keys[i];
          if (!equal(a[key], b[key])) return false;
        }
        return true;
      }
      return a !== a && b !== b;
    };
  }
});
var require_equal = __commonJS({
  "node_modules/ajv/dist/runtime/equal.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var equal = require_fast_deep_equal();
    equal.code = 'require("ajv/dist/runtime/equal").default';
    exports.default = equal;
  }
});
var func2 = require_ucs2length().default;
var func0 = require_equal().default;
var pattern0 = new RegExp("\\S", "u");

// src/model/validate.ts
var MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;

// src/cli/common.ts
var InputError = class extends Error {
};
function parseArguments(argv, valueOptions, flagOptions = []) {
  const result = { values: /* @__PURE__ */ new Map(), flags: /* @__PURE__ */ new Set() };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      if (result.values.has(arg) || result.flags.has(arg)) throw new InputError(`\u91CD\u590D\u53C2\u6570\uFF1A${arg}`);
      if (flagOptions.includes(arg) || arg === "--help") result.flags.add(arg);
      else if (valueOptions.includes(arg)) {
        const value = argv[++i];
        if (value === void 0 || value.startsWith("--")) throw new InputError(`\u53C2\u6570 ${arg} \u7F3A\u5C11\u503C\u3002`);
        result.values.set(arg, value);
      } else throw new InputError(`\u672A\u77E5\u53C2\u6570\uFF1A${arg}`);
    } else if (!result.input) result.input = arg;
    else throw new InputError(`\u591A\u4F59\u7684\u8F93\u5165\u8DEF\u5F84\uFF1A${arg}`);
  }
  return result;
}
async function readInput(path, limit) {
  let file;
  try {
    file = await open(resolve(path), "r");
    const info = await file.stat();
    if (!info.isFile()) throw new InputError(`\u8F93\u5165\u4E0D\u662F\u666E\u901A\u6587\u4EF6\uFF1A${path}`);
    if (limit !== void 0 && info.size > limit) throw new InputError("DOCUMENT_SIZE_LIMIT: \u56FE\u6570\u636E\u8D85\u8FC7 2 MiB\uFF0C\u8BF7\u62C6\u4E3A\u603B\u89C8\u4E0E\u5B50\u56FE\u3002");
    const bytes = await file.readFile();
    if (limit !== void 0 && bytes.byteLength > limit) throw new InputError("DOCUMENT_SIZE_LIMIT: \u56FE\u6570\u636E\u8D85\u8FC7 2 MiB\uFF0C\u8BF7\u62C6\u4E3A\u603B\u89C8\u4E0E\u5B50\u56FE\u3002");
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
  } catch (error) {
    if (error instanceof InputError) throw error;
    throw new InputError(`\u65E0\u6CD5\u8BFB\u53D6 UTF-8 \u8F93\u5165 ${path}\uFF1A${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await file?.close();
  }
}
async function checkOutput(path, overwrite, input) {
  if (input && resolve(path).toLowerCase() === resolve(input).toLowerCase()) throw new InputError("\u8F93\u51FA\u8DEF\u5F84\u4E0D\u80FD\u4E0E\u8F93\u5165\u8DEF\u5F84\u76F8\u540C\u3002");
  if (!overwrite) {
    try {
      await access(path);
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    throw new InputError(`\u76EE\u6807\u5DF2\u5B58\u5728\uFF0C\u8BF7\u4F7F\u7528 --overwrite\uFF1A${path}`);
  }
}
async function atomicWrite(path, content, overwrite) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try {
    const handle = await open(temporary, "wx");
    try {
      await handle.writeFile(content);
      await handle.sync();
    } finally {
      await handle.close();
    }
    if (overwrite) await rename(temporary, path);
    else {
      try {
        await link(temporary, path);
      } catch (error) {
        if (error.code === "EEXIST") throw new InputError(`\u76EE\u6807\u5DF2\u5B58\u5728\uFF0C\u8BF7\u4F7F\u7528 --overwrite\uFF1A${path}`);
        throw error;
      }
    }
  } finally {
    await unlink(temporary).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}
function requireExtension(path, extensions) {
  if (!extensions.includes(extname(path).toLowerCase())) throw new InputError(`\u6587\u4EF6\u6269\u5C55\u540D\u5FC5\u987B\u4E3A ${extensions.join(" / ")}\uFF1A${path}`);
}
function runCli(main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = error instanceof InputError ? 2 : 1;
  });
}

// src/cli/export-options.ts
import { extname as extname2, resolve as resolve2 } from "node:path";
var exportHelp = `\u7528\u6CD5\uFF1Anode export.mjs input.html --format svg|png|jpg|jpeg [--output file] [--scale 2] [--background '#FFFFFF'] [--theme light|dark] [--svg-index 0] [--overwrite]
\u4F9D\u8D56\uFF1A\u5728 skill \u76EE\u5F55 npm ci\uFF0C\u518D\u8FD0\u884C node node_modules/playwright/cli.js install chromium\u3002
SVG \u4EC5\u652F\u6301 v2 HTML\uFF0C\u4E0D\u63A5\u53D7 --scale\u3002\u4F4D\u56FE scale \u4E3A 0.5\u20134\uFF1B\u9ED8\u8BA4 2\u3002
legacy HTML \u4EC5\u652F\u6301\u9759\u6001\u3001\u81EA\u5305\u542B\u7684\u5185\u8054 SVG\uFF1B\u4E0D\u6267\u884C\u9875\u9762\u811A\u672C\u3002\u591A\u4E2A SVG \u65F6\u5FC5\u987B --svg-index\u3002
\u65B0\u5165\u53E3\u9ED8\u8BA4\u7981\u6B62\u8986\u76D6\uFF1BPython \u517C\u5BB9\u5165\u53E3\u4FDD\u7559\u8986\u76D6\u884C\u4E3A\u3002`;
function parseExportOptions(argv) {
  const args = parseArguments(argv, ["--format", "--output", "--scale", "--background", "--theme", "--svg-index"], ["--overwrite"]);
  if (args.flags.has("--help")) return void 0;
  const format = args.values.get("--format");
  if (!args.input || !format || !["svg", "png", "jpg", "jpeg"].includes(format)) throw new InputError(exportHelp);
  requireExtension(args.input, [".html", ".htm"]);
  if (format === "svg" && args.values.has("--scale")) throw new InputError("SVG \u662F\u77E2\u91CF\u683C\u5F0F\uFF0C\u4E0D\u80FD\u6307\u5B9A --scale\u3002");
  const scale = Number(args.values.get("--scale") ?? 2);
  if (!Number.isFinite(scale) || scale < 0.5 || scale > 4) throw new InputError("--scale \u5FC5\u987B\u4E3A 0.5\u20134 \u7684\u6709\u9650\u6570\u503C\u3002");
  const theme = args.values.get("--theme");
  if (theme !== void 0 && theme !== "light" && theme !== "dark") throw new InputError("--theme \u5FC5\u987B\u4E3A light \u6216 dark\u3002");
  const index = args.values.get("--svg-index");
  if (index !== void 0 && !/^\d+$/.test(index)) throw new InputError("--svg-index \u5FC5\u987B\u4E3A\u4ECE 0 \u5F00\u59CB\u7684\u975E\u8D1F\u6574\u6570\u3002");
  const svgIndex = index === void 0 ? void 0 : Number(index);
  if (svgIndex !== void 0 && !Number.isSafeInteger(svgIndex)) throw new InputError("--svg-index \u8D85\u51FA\u6709\u6548\u6574\u6570\u8303\u56F4\u3002");
  const input = resolve2(args.input);
  const output = resolve2(args.values.get("--output") ?? `${input.slice(0, -extname2(input).length)}.${format === "jpeg" ? "jpg" : format}`);
  requireExtension(output, format === "jpg" || format === "jpeg" ? [".jpg", ".jpeg"] : [`.${format}`]);
  return { input, output, format, scale, theme, background: args.values.get("--background"), svgIndex, overwrite: args.flags.has("--overwrite") };
}
function checkRasterSize(width, height, scale) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error("\u5BFC\u51FA\u56FE\u5F62\u6CA1\u6709\u6709\u6548\u7684\u6B63\u6570\u5C3A\u5BF8\u3002");
  const pixelWidth = Math.ceil(width * scale);
  const pixelHeight = Math.ceil(height * scale);
  if (pixelWidth > 16e3 || pixelHeight > 16e3 || pixelWidth * pixelHeight > 4e7) throw new InputError(`\u4F4D\u56FE\u5C3A\u5BF8 ${pixelWidth}\xD7${pixelHeight} \u8D85\u8FC7\u5355\u8FB9 16000 / \u603B\u50CF\u7D20 40000000 \u9650\u5236\uFF1B\u8BF7\u964D\u4F4E --scale \u6216\u62C6\u56FE\u3002`);
  return { pixelWidth: Math.round(width * scale), pixelHeight: Math.round(height * scale) };
}

// src/cli/legacy.ts
async function inspectHtml(page, html) {
  await page.setContent(`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' data:; img-src data:; font-src data:; script-src 'none'; base-uri 'none'">${html}`, { waitUntil: "load" });
  return page.evaluate(() => {
    const version = document.querySelector('meta[name="system-blueprint"]')?.getAttribute("content");
    const data = document.querySelector("#blueprint-data");
    const resources = [];
    const allowed = (url) => !url.trim() || url.trim().startsWith("#") || /^data:/i.test(url.trim());
    const inspectCss = (css) => {
      for (const match of css.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/gi)) if (!allowed(match[1])) resources.push(match[1]);
      for (const match of css.matchAll(/@import\s+['"]([^'"]+)['"]/gi)) if (!allowed(match[1])) resources.push(match[1]);
    };
    for (const element of document.querySelectorAll("*")) {
      for (const name of ["src", "poster", "data", "srcset"]) {
        const value = element.getAttribute(name);
        if (value && !allowed(value)) resources.push(`${element.localName}[${name}]=${value}`);
      }
      if (["link", "image", "use", "feImage"].includes(element.localName)) {
        const value = element.getAttribute("href") ?? element.getAttribute("xlink:href");
        if (value && !allowed(value)) resources.push(`${element.localName}[href]=${value}`);
      }
      if (element.localName === "iframe" || element.localName === "object" || element.localName === "embed") resources.push(`\u4E0D\u652F\u6301\u5D4C\u5165\u5185\u5BB9\uFF1A${element.localName}`);
      if (element.localName === "meta" && element.getAttribute("http-equiv")?.toLowerCase() === "refresh") resources.push("meta refresh");
      for (const attr of Array.from(element.attributes)) {
        for (const match of attr.value.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/gi)) if (!allowed(match[1])) resources.push(match[1]);
      }
      if (element.style) inspectCss(element.style.cssText);
    }
    for (const style of document.querySelectorAll("style")) {
      inspectCss(style.textContent ?? "");
      for (const rule of Array.from(style.sheet?.cssRules ?? [])) inspectCss(rule.cssText);
    }
    return { version, hasData: !!data, resources: [...new Set(resources)], svgs: Array.from(document.querySelectorAll("svg")).filter((svg) => !svg.parentElement?.closest("svg")).map((svg, index) => ({ index, label: svg.getAttribute("aria-label") ?? svg.querySelector("title")?.textContent ?? svg.id ?? "", viewBox: svg.getAttribute("viewBox") })) };
  });
}
async function prepareLegacyExport(page, index, background) {
  await page.evaluate(() => document.fonts.ready.then(() => void 0));
  const result = await page.evaluate(({ index: index2, background: background2 }) => {
    const candidates = Array.from(document.querySelectorAll("svg")).filter((svg) => !svg.parentElement?.closest("svg"));
    const source = candidates[index2];
    const viewBox = source.viewBox.baseVal;
    const length = (name) => {
      const value = source.getAttribute(name);
      if (!value || /%|auto/.test(value)) return void 0;
      const animated = name === "width" ? source.width : source.height;
      return animated.baseVal.value || void 0;
    };
    let width = length("width");
    let height = length("height");
    if (!width && height && viewBox.width > 0 && viewBox.height > 0) width = height * viewBox.width / viewBox.height;
    if (!height && width && viewBox.width > 0 && viewBox.height > 0) height = width * viewBox.height / viewBox.width;
    width ??= viewBox.width || source.getBoundingClientRect().width;
    height ??= viewBox.height || source.getBoundingClientRect().height;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return { error: "\u9009\u5B9A SVG \u6CA1\u6709\u6709\u6548\u7684 width/height \u6216 viewBox\u3002" };
    width = Math.ceil(width);
    height = Math.ceil(height);
    const sourceRect = source.getBoundingClientRect();
    const backdrop = document.createElement("div");
    const scaleX = sourceRect.width > 0 ? width / sourceRect.width : 1;
    const scaleY = sourceRect.height > 0 ? height / sourceRect.height : 1;
    backdrop.style.cssText = `all:initial;position:absolute;left:0;top:0;width:${sourceRect.width}px;height:${sourceRect.height}px;transform-origin:0 0;transform:scale(${scaleX},${scaleY});z-index:0;pointer-events:none;`;
    if (background2 === void 0) {
      const backgrounds = [];
      for (let parent = source.parentElement; parent; parent = parent.parentElement) {
        const css = getComputedStyle(parent);
        const rect = parent.getBoundingClientRect();
        if (css.backgroundImage === "none" && (css.backgroundColor === "transparent" || css.backgroundColor === "rgba(0, 0, 0, 0)")) continue;
        const layer = document.createElement("div");
        layer.style.cssText = `all:initial;position:absolute;box-sizing:border-box;left:${rect.left - sourceRect.left}px;top:${rect.top - sourceRect.top}px;width:${rect.width}px;height:${rect.height}px;border-style:solid;border-color:transparent;pointer-events:none;`;
        for (const property of [
          "background-color",
          "background-image",
          "background-position",
          "background-size",
          "background-repeat",
          "background-origin",
          "background-clip",
          "background-blend-mode",
          "border-top-width",
          "border-right-width",
          "border-bottom-width",
          "border-left-width",
          "border-radius",
          "padding-top",
          "padding-right",
          "padding-bottom",
          "padding-left"
        ]) layer.style.setProperty(property, css.getPropertyValue(property));
        backgrounds.unshift(layer);
      }
      backdrop.append(...backgrounds);
    }
    const clone = source.cloneNode(true);
    const originals = [source, ...source.querySelectorAll("*")];
    const copies = [clone, ...clone.querySelectorAll("*")];
    originals.forEach((original, i) => {
      const css = getComputedStyle(original);
      const target = copies[i];
      for (const property of Array.from(css)) {
        const value = css.getPropertyValue(property).replace(/url\(["']?[^)"']*#([^)'" ]+)["']?\)/g, "url(#$1)");
        target.style.setProperty(property, value);
      }
    });
    clone.querySelectorAll("script").forEach((script) => script.remove());
    clone.setAttribute("width", String(width));
    clone.setAttribute("height", String(height));
    clone.style.cssText += `;width:${width}px!important;height:${height}px!important;max-width:none!important;max-height:none!important;position:relative!important;z-index:1!important;transform:none!important;margin:0!important;display:block!important;`;
    const wrapper = document.createElement("div");
    wrapper.id = "blueprint-legacy-export";
    wrapper.style.cssText = `width:${width}px;height:${height}px;position:relative;isolation:isolate;overflow:hidden;background:${background2 ?? "white"};`;
    wrapper.append(backdrop, clone);
    document.body.replaceChildren(wrapper);
    document.documentElement.style.cssText = "margin:0;padding:0;min-width:0;min-height:0;";
    document.body.style.cssText = "margin:0;padding:0;min-width:0;min-height:0;background:transparent;display:block;";
    return { elementId: wrapper.id, width, height };
  }, { index, background });
  if ("error" in result) throw new InputError(result.error);
  return result;
}

// src/cli/export.ts
async function bounded(operation) {
  let timer;
  try {
    return await Promise.race([operation, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("\u5BFC\u51FA 30 \u79D2\u5185\u672A\u5B8C\u6210\uFF0C\u8BF7\u68C0\u67E5\u6E32\u67D3\u8BCA\u65AD\u6216\u62C6\u5206\u56FE\u5F62\u3002")), 3e4);
    })]);
  } finally {
    clearTimeout(timer);
  }
}
async function loadPlaywright() {
  const skill = resolve3(dirname2(fileURLToPath(import.meta.url)), "..");
  const require2 = createRequire(resolve3(skill, "package.json"));
  try {
    const installed = await realpath(resolve3(skill, "node_modules/playwright"));
    const entry = await realpath(require2.resolve("playwright"));
    const local = relative(installed, entry);
    if (local.startsWith("..") || isAbsolute(local)) throw new Error("\u89E3\u6790\u5230\u4E86 skill \u76EE\u5F55\u4E4B\u5916\u7684 Playwright\u3002");
    return require2(entry);
  } catch (error) {
    throw new Error(`\u7F3A\u5C11 skill \u5185\u7684 Playwright\uFF0C\u4E0D\u80FD\u501F\u7528\u4ED3\u5E93\u6839\u76EE\u5F55\u4F9D\u8D56\u3002\u8BF7\u6267\u884C npm ci --prefix "${skill}"\uFF0C\u518D\u6267\u884C node "${resolve3(skill, "node_modules/playwright/cli.js")}" install chromium\u3002
${error instanceof Error ? error.message : String(error)}`);
  }
}
async function waitForExportApi(page) {
  await page.evaluate(async () => {
    const api = window.blueprint;
    if (!api || !api.ready || typeof api.whenIdle !== "function" || typeof api.exportSvg !== "function" || typeof api.prepareRasterExport !== "function" || typeof api.disposeExport !== "function") throw new Error("v2 HTML \u7F3A\u5C11\u5B8C\u6574 blueprint \u5BFC\u51FA\u63A5\u53E3\uFF1B\u8BF7\u91CD\u65B0\u751F\u6210 HTML\u3002");
    let timer;
    try {
      await Promise.race([(async () => {
        await api.ready;
        await api.whenIdle();
      })(), new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("\u56FE\u5F62 30 \u79D2\u5185\u672A\u5C31\u7EEA\uFF0C\u8BF7\u68C0\u67E5\u6E32\u67D3\u8BCA\u65AD\u3002")), 3e4);
      })]);
    } finally {
      clearTimeout(timer);
    }
  });
}
runCli(async () => {
  const options = parseExportOptions(process.argv.slice(2));
  if (!options) {
    console.log(exportHelp);
    return;
  }
  await checkOutput(options.output, options.overwrite, options.input);
  const html = await readInput(options.input);
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ channel: "chromium", args: ["--disable-gpu"] });
  try {
    const blocked = [];
    let context = await browser.newContext({ javaScriptEnabled: false, deviceScaleFactor: options.scale, viewport: { width: 1600, height: 1e3 }, serviceWorkers: "block" });
    await context.route("**/*", (route) => {
      blocked.push(route.request().url());
      return route.abort();
    });
    let page = await context.newPage();
    page.setDefaultTimeout(3e4);
    const inspection = await inspectHtml(page, html);
    if (inspection.resources.length) throw new InputError(`HTML \u7F3A\u5C11\u81EA\u5305\u542B\u8D44\u6E90\uFF0C\u5916\u90E8\u8D44\u6E90\u4E0D\u4F1A\u88AB\u52A0\u8F7D\uFF1A
${inspection.resources.join("\n")}`);
    const background = options.background === void 0 ? void 0 : await page.evaluate((value) => {
      if (!CSS.supports("color", value) || /^(inherit|initial|unset|revert|currentcolor)$/i.test(value.trim())) return null;
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = value;
      ctx.fillRect(0, 0, 1, 1);
      const rgba = ctx.getImageData(0, 0, 1, 1).data;
      if (rgba[3] !== 255) return null;
      return `#${[...rgba].slice(0, 3).map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
    }, options.background);
    if (background === null) throw new InputError("--background \u5FC5\u987B\u4E3A\u6709\u6548\u7684\u4E0D\u900F\u660E CSS \u989C\u8272\u3002");
    const isV2 = inspection.version != null || inspection.hasData;
    const staticOptions = { theme: options.theme, background };
    let capture;
    if (isV2) {
      if (inspection.version !== "2.0" || !inspection.hasData) throw new InputError(`\u4E0D\u652F\u6301\u6216\u4E0D\u5B8C\u6574\u7684 v2 HTML schema \u6807\u8BC6\uFF1A${inspection.version ?? "missing"}\u3002`);
      if (options.svgIndex !== void 0) throw new InputError("--svg-index \u4EC5\u7528\u4E8E legacy HTML\u3002");
      await context.close();
      context = await browser.newContext({ deviceScaleFactor: options.format === "svg" ? 1 : options.scale, viewport: { width: 1600, height: 1e3 }, serviceWorkers: "block" });
      const inputUrl = pathToFileURL(options.input).href;
      await context.route("**/*", (route) => {
        if (route.request().url() === inputUrl) return route.continue();
        blocked.push(route.request().url());
        return route.abort();
      });
      page = await context.newPage();
      page.setDefaultTimeout(3e4);
      await page.goto(inputUrl, { waitUntil: "load", timeout: 3e4 });
      await waitForExportApi(page);
      if (options.format === "svg") {
        const svg = await bounded(page.evaluate((settings) => window.blueprint.exportSvg(settings), staticOptions));
        if (blocked.length) throw new Error(`\u5BFC\u51FA\u65F6\u53D1\u73B0\u5916\u90E8\u8BF7\u6C42\uFF1A${blocked.join(", ")}`);
        await atomicWrite(options.output, svg, options.overwrite);
        console.log(JSON.stringify({ output: options.output, format: "svg", bytes: Buffer.byteLength(svg), mode: "v2" }));
        return;
      }
      capture = await bounded(page.evaluate((settings) => window.blueprint.prepareRasterExport(settings), staticOptions));
    } else {
      if (options.format === "svg") throw new InputError("legacy HTML \u4EC5\u652F\u6301 PNG/JPEG\uFF1BSVG \u81EA\u52A8\u5BFC\u51FA\u8981\u6C42 v2 HTML\u3002");
      if (options.theme !== void 0) throw new InputError("--theme \u4EC5\u7528\u4E8E v2 HTML\uFF1Blegacy HTML \u4FDD\u7559\u539F\u59CB\u6837\u5F0F\u3002");
      if (!inspection.svgs.length) throw new InputError("legacy HTML \u672A\u627E\u5230\u9759\u6001\u5185\u8054 SVG\uFF1B\u6B64\u5165\u53E3\u4E0D\u6267\u884C\u9875\u9762\u811A\u672C\u751F\u6210\u56FE\u5F62\u3002");
      if (options.svgIndex === void 0 && inspection.svgs.length !== 1) throw new InputError(`HTML \u5305\u542B\u591A\u4E2A SVG\uFF0C\u8BF7\u7528 --svg-index \u9009\u62E9\uFF1A
${inspection.svgs.map((svg) => `${svg.index}: ${svg.label || "(\u65E0\u6807\u9898)"} [${svg.viewBox ?? "\u65E0 viewBox"}]`).join("\n")}`);
      const index = options.svgIndex ?? 0;
      if (index >= inspection.svgs.length) throw new InputError(`--svg-index ${index} \u8D8A\u754C\uFF1B\u53EF\u9009\u7D22\u5F15\u4E3A 0\u2013${inspection.svgs.length - 1}\u3002`);
      capture = await bounded(prepareLegacyExport(page, index, background));
    }
    try {
      const pixels = checkRasterSize(capture.width, capture.height, options.scale);
      await page.setViewportSize({ width: Math.max(1, Math.min(16e3, Math.ceil(capture.width))), height: Math.max(1, Math.min(16e3, Math.ceil(capture.height))) });
      const target = page.locator(`[id=${JSON.stringify(capture.elementId)}]`);
      const bounds = await target.boundingBox();
      if (!bounds || Math.abs(bounds.width - capture.width) > 1 || Math.abs(bounds.height - capture.height) > 1) throw new Error("\u5BFC\u51FA\u5BB9\u5668\u5C3A\u5BF8\u4E0E\u5BFC\u51FA\u63A5\u53E3\u4E0D\u4E00\u81F4\u3002");
      const bytes = await target.screenshot({ type: options.format === "png" ? "png" : "jpeg", ...options.format === "png" ? {} : { quality: 95 }, animations: "disabled", timeout: 3e4 });
      if (blocked.length) throw new Error(`\u5BFC\u51FA\u65F6\u53D1\u73B0\u5916\u90E8\u8BF7\u6C42\uFF1A${blocked.join(", ")}`);
      await atomicWrite(options.output, bytes, options.overwrite);
      console.log(JSON.stringify({ output: options.output, format: options.format, bytes: bytes.length, width: capture.width, height: capture.height, ...pixels, scale: options.scale, mode: isV2 ? "v2" : "legacy" }));
    } finally {
      if (isV2 && capture) await page.evaluate((id) => window.blueprint.disposeExport(id), capture.elementId);
    }
  } finally {
    await browser.close();
  }
});
