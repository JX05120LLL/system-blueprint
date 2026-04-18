---
name: system-blueprint
description: Generate polished system blueprints, architecture diagrams, deployment topology views, integration maps, data-flow visuals, and technical overview graphics as standalone HTML files with inline SVG. Use when the user asks for an architecture diagram, system map, topology view, component relationship visual, deployment view, data-flow visual, request-flow visual, agent runtime diagram, memory flow diagram, or when Mermaid output should be upgraded into presentation-quality visuals. Also use when updating an existing HTML or SVG system diagram.
---

# System Blueprint Skill

Create presentation-quality technical diagrams from a codebase, spec, or plain-language description.

This skill is intentionally packaged around the common `SKILL.md + assets/` pattern so it can be adapted across Codex, Claude-style skills, and other agents that read the same lightweight skill structure.

## Default output

Prefer a standalone HTML file with inline SVG.

Use Mermaid only when the user explicitly wants Markdown-native diagrams or when the target surface cannot host HTML files.

Use `assets/template.html` as the base document unless the user already has an existing system-diagram HTML file that should be updated in place.

When the user needs README-friendly assets, also generate standalone SVG files.

When the user needs common image formats, export the final HTML or SVG into PNG or JPG with `scripts/export_diagram.py`.

## Workflow

1. Extract the system model before drawing.
2. Normalize the system into:
   - components
   - groups or trust boundaries
   - connections
   - protocols or data labels
   - one or more key flows
3. Choose a view type:
   - system overview
   - deployment topology
   - request or control flow
   - data flow
   - agent runtime and memory flow
   - system blueprint with layered boundaries
   - before vs after comparison
4. Keep the first version simple:
   - 4-10 primary nodes
   - 1-3 group containers
   - a small legend or summary area
5. Render the diagram into a self-contained HTML file with inline SVG.
6. If README embedding is needed, emit one or more standalone SVG examples.
7. If PNG or JPG is needed, export from the HTML or SVG output.
8. If the user asks for iteration, update the same file and preserve the visual language.

## Output contract

When producing HTML output:

- Keep the file self-contained.
- Keep styles inline in the HTML file.
- Keep the diagram in inline SVG.
- Avoid JavaScript unless the user explicitly asks for interactive behavior.
- Avoid external runtime dependencies.
- Prefer semantic color coding and consistent spacing.

Suggested destination if the user does not specify one:

- `docs/architecture/<diagram-name>.html`

Use a kebab-case filename.

Suggested names:

- `system-blueprint.html`
- `runtime-architecture.html`
- `deployment-topology.html`
- `agent-memory-flow.html`

Suggested image names:

- `system-blueprint-overview.svg`
- `runtime-flow.png`
- `deployment-topology.jpg`

## Layout rules

- Prefer left-to-right layout for request flow, service interactions, and layered systems.
- Prefer top-to-bottom layout for lifecycle, decision flow, and pipeline diagrams.
- Prefer grouped containers for bounded contexts, trust zones, layers, or subsystems.
- Group related nodes inside bounded containers when it improves readability.
- Keep arrows behind boxes when possible.
- Do not cross lines unless the alternative is worse.
- Keep labels short and legible.
- Make the title and subtitle useful enough that the file can be shared out of context.

## Visual rules

- Use a dark background and strong contrast by default.
- Favor a modern technical presentation style over enterprise clip-art aesthetics.
- Use one color family per semantic role, for example:
  - client or entry
  - application or services
  - data or storage
  - integrations or external systems
  - security or identity
- Keep boxes visually consistent:
  - rounded corners
  - subtle border
  - soft shadow or glow
  - short title and one supporting line
- Include a small summary or legend area below or beside the diagram when it adds clarity.
- Keep the first version tasteful and restrained; use polish, not ornament.

## Editing existing diagrams

When updating an existing HTML system diagram:

- preserve the file structure when practical
- preserve stable IDs or class names when practical
- update content and layout without rewriting unrelated sections
- keep the existing visual language unless the user asks for a redesign

## If the source is a codebase

First extract:

- entry points
- frontend or client surfaces
- APIs and services
- databases and caches
- queues, schedulers, or background workers
- third-party integrations
- auth or identity boundaries
- deployment targets
- durable business objects when they matter to the architecture

Then collapse low-value details into grouped nodes instead of drawing every class or file.

## If the source is a design discussion

Clarify only the minimum needed:

- what the main system boundary is
- which components are internal vs external
- which flows matter most
- whether the user wants overview, runtime flow, or deployment view
- whether the output is meant for docs, README, presentation, or stakeholder review

If details are missing, make a clearly labeled first-pass diagram rather than blocking.

## Do not

- dump raw Mermaid when polished HTML output is acceptable
- draw every implementation detail from the codebase
- over-label every edge
- add decorative elements that make the diagram harder to read
- rely on external JS libraries for basic rendering
- mimic cloud vendor icon sheets unless the user explicitly asks for that style

## Bundled asset

Use `assets/template.html` as the default base file. Replace the placeholder title, subtitle, badges, cards, legend, and SVG scene with task-specific content.

## Bundled script

Use `scripts/export_diagram.py` when the user needs:

- `HTML -> PNG`
- `HTML -> JPG`
- `SVG -> PNG`
- `SVG -> JPG`

If the environment does not have `cairosvg`, explain that raster export needs:

- `pip install cairosvg`

Use SVG directly when the user only needs GitHub README embedding.
