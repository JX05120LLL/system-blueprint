# Third-party notices

The offline viewer includes the following libraries. Their installed upstream license texts are copied without alteration into `references/licenses/`. These links identify source repositories; the generated HTML loads no remote resources.

| Package | Version | License | Source |
| --- | --- | --- | --- |
| elkjs | 0.11.0 | [EPL-2.0](references/licenses/elkjs.txt) | [upstream](https://github.com/kieler/elkjs) |
| ajv | 8.17.1 | [MIT](references/licenses/ajv.txt) | [upstream](https://github.com/ajv-validator/ajv) |
| fast-deep-equal | 3.1.3 | [MIT](references/licenses/fast-deep-equal.txt) | [upstream](https://github.com/epoberezkin/fast-deep-equal) |
| d3-selection | 3.0.0 | [ISC](references/licenses/d3-selection.txt) | [upstream](https://github.com/d3/d3-selection) |
| d3-zoom | 3.0.0 | [ISC](references/licenses/d3-zoom.txt) | [upstream](https://github.com/d3/d3-zoom) |
| d3-dispatch | 3.0.1 | [ISC](references/licenses/d3-dispatch.txt) | [upstream](https://github.com/d3/d3-dispatch) |
| d3-drag | 3.0.0 | [ISC](references/licenses/d3-drag.txt) | [upstream](https://github.com/d3/d3-drag) |
| d3-interpolate | 3.0.1 | [ISC](references/licenses/d3-interpolate.txt) | [upstream](https://github.com/d3/d3-interpolate) |
| d3-transition | 3.0.1 | [ISC](references/licenses/d3-transition.txt) | [upstream](https://github.com/d3/d3-transition) |
| d3-color | 3.1.0 | [ISC](references/licenses/d3-color.txt) | [upstream](https://github.com/d3/d3-color) |
| d3-timer | 3.0.1 | [ISC](references/licenses/d3-timer.txt) | [upstream](https://github.com/d3/d3-timer) |
| d3-ease | 3.0.1 | [BSD-3-Clause](references/licenses/d3-ease.txt) | [upstream](https://github.com/d3/d3-ease) |

ELK is upstream code distributed under EPL-2.0. The corresponding elkjs wrapper and build sources are available at [elkjs 0.11.0](https://github.com/kieler/elkjs/tree/0.11.0); its [build definition](https://raw.githubusercontent.com/kieler/elkjs/0.11.0/build.gradle) identifies the Eclipse Layout Kernel modules incorporated into the worker. The underlying Java layout sources are in the [Eclipse Layout Kernel repository](https://github.com/eclipse-elk/elk). The application embeds the installed upstream `elk-worker.min.js` without changing its layout algorithms.

The optional export dependency is Playwright 1.58.2 (Apache-2.0). Its license and third-party notices are installed by `npm ci` in the skill directory; Chromium carries its own notices in the installed browser distribution.

Build-only dependencies (TypeScript, esbuild, json-schema-to-typescript, tsx and test tools) are locked in the repository package-lock.json. They are not needed to generate HTML from an installed skill.

The drawio-skill repository was consulted for workflow and review ideas only; no upstream implementation code was copied. Reference decisions are recorded in the repository docs/validation/drawio-reference.md.
