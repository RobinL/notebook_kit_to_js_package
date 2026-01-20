# `data-name` usage: current support + plan

This repo (`notebook-to-lib`) converts notebook-kit HTML exports into an Observable Runtime-compatible JS package.

You asked specifically about a build process where notebook cells can be *named* using `data-name`, and then *targeted* in a custom HTML template using `data-cell` (so cell output mounts into specific DOM nodes without needing a brittle `switch (name) { ... }`).

This document summarizes what the repo supports today, what’s missing for the `data-name` → `data-cell` flow, and a high-level plan to add first-class support.

---

## Current repo behavior (what exists today)

### 1) Parsing: `data-name` is already extracted

- The parser reads `data-name` on each `<script>` and stores it as `RawCell.name`.
- Implementation: `parseNotebookHtml()` in `src/parse.ts`.

Important detail:
- The parser currently selects **all** `<script>` tags in the whole document (`doc.querySelectorAll("script")`), not just those under `<notebook>`.
  - This is fine for simple notebook exports like `test-notebooks/hello.html` (which only contains notebook scripts).
  - It becomes a foot-gun if you introduce templates that also include `<script>` tags outside the notebook (analytics, hot reload, loaders, etc.).

### 2) Transpiling: `data-name` drives which variables get defined

- Each cell is processed by `processCell()` in `src/transpile.ts`.
- The generated outputs are intentionally overridden:
  - If a cell has a `data-name`, outputs become either `[name]` or `["viewof " + name]`.
  - This is a pragmatic choice to avoid notebook-kit’s tendency to over-report outputs.

View cell detection:
- If the cell has a `data-name` and contains `const <name> = view(` (after basic regex matching), it is treated as a view cell.
- For view cells, generation also synthesizes the “value cell” (e.g. `one` from `viewof one`) via `Generators.input`.

### 3) Generating `define.js`: names flow into Observable Runtime observer names

- `generateDefineJs()` in `src/generate.ts` emits a standard Observable Runtime module with `main.variable(observer(name)).define(...)` calls.
- For cells with `data-name`, the defined variable names are stable:
  - View cells define `"viewof <name>"` and also define the derived `<name>`.
  - Non-view cells define `<name>`.

### 4) How the README example routes output today

At the bottom of the repo README, the integration pattern is:

- `runtime.module(define, (name) => { switch (name) { ... } })`
- You match **Observable variable names** (e.g. `"viewof one"`, `"out"`) and return a specific `new Inspector(domNode)` for each.

This is functional, but brittle for larger notebooks and custom layouts.

---

## Do we currently support `data-name` → `data-cell` targeting?

**No (not end-to-end).**

What is supported:
- `data-name` is parsed and affects which variable names are defined in the generated module.

What is NOT supported (missing pieces):
- No concept of a `cells` metadata array that includes multiple selectors per cell (e.g. `["one", "cell:0"]`).
- No `mount()` helper that automatically routes cell output to DOM targets.
- No built-in support for `[data-cell="..."]` template targeting.
- No stable fallback selector like `cell:<id>`.
- Parsing is not scoped to `<notebook>`, which makes template-driven builds risky.

So, today `data-name` helps (it stabilizes variable names), but the “template authoring” experience you described is not implemented in this repo.

---

## Why the README example feels flaky

The switch-based observer routing is fragile because it couples your layout to the *runtime’s variable naming and emission behavior*.

Common sources of flakiness:

1) **View cells emit multiple observable variables**
   - A single input cell effectively produces both `"viewof one"` (the element) and `"one"` (its current value).
   - If you only route `"viewof one"`, you might still see `"one"` showing up somewhere (depending on what your observer returns for defaults).

2) **Unnamed / markdown / side-effect cells don’t have stable names**
   - When the generator uses `observer()` (anonymous), the observer callback may receive `undefined`/no name, which is hard to route.

3) **Using `true` as the default observer return is non-obvious**
   - The runtime has special handling for non-observer return values.
   - Practically, this often results in “some stuff renders, some stuff disappears / goes to a default place” and that’s hard to reason about.

4) **Name surface area grows as the notebook grows**
   - Even if you stabilize cell outputs with `data-name`, you can still introduce other defined variables over time.
   - A switch statement must be kept in sync manually.

5) **Template scripts can interfere with parsing (future risk)**
   - If you move to a template-driven build and your HTML includes extra `<script>` tags, `src/parse.ts` will treat them as notebook cells unless we scope parsing.

---

## Desired behavior (your proposed flow)

Your preferred approach is:

- Author notebooks with `data-name` on cell `<script>` tags.
- Author templates with `<div data-cell="one"></div>` placeholders.
- Let the build output include a `mount()` that:
  - Finds the right DOM node for each cell using `definition.names`.
  - Mounts matched cells into those nodes.
  - Appends unmatched cells to `#notebook-root` or the container.

This is a good direction because it:
- moves targeting concerns into declarative HTML rather than JS switches
- creates stable, human-friendly hooks
- allows graceful fallback (`cell:<id>`) when names aren’t provided

---

## High-level plan to add first-class support

### Phase 0 — clarify scope / API shape

Decide the primary output artifact:

- **Option A (library-first)**: keep `define.js` as-is, but add a helper export `mount()` that internally creates a `Runtime` + routes `Inspector`s.
- **Option B (bundle-first)**: create a second output mode that emits a browser-ready bundle/IIFE that auto-mounts based on `[data-cell]`.

Given this repo’s current positioning (“convert to reusable libraries”), **Option A** is the minimal, aligned step.

### Phase 1 — make parsing safe for templates

Update `parseNotebookHtml()`:

- Prefer `<notebook>` scoping:
  - Find the `<notebook>` element and only consider its descendant `<script>` tags.
  - Fall back to `document.querySelectorAll("script")` only if `<notebook>` is absent.
- Preserve a stable, explicit **cell index** (0-based) in addition to the existing `id` counter.
  - This enables a reliable `cell:<index>` or `cell:<id>` fallback.

Acceptance:
- Template HTML with unrelated `<script>` tags does not create extra cells.

### Phase 2 — propagate names as a selector list (not just a single output name)

Introduce a richer generated metadata structure:

- For each cell, compute `names: string[]`:
  - include the explicit `data-name` (if any)
  - include a stable fallback selector like `cell:<id>` or `cell:<index>`
  - (optional) include `viewof <name>` for view cells *as another alias* (see Phase 3 notes)

Export this as something like:

- `export const cells = [{ id, names, inputs, outputs, ... }]`

Acceptance:
- Consumers can target cells without knowing runtime internal variable names.

### Phase 3 — add a `mount()` helper that routes output to DOM targets

Generate a helper (either in `runtime.js` or a new `mount.js`) with a signature like:

- `mount(container?: Element, options?: { targets?: Record<string, Element>, selector?: string | ((cell) => Element | null), appendUnmatched?: boolean })`

Routing behavior (matches your described approach):

1) If `options.selector` is a function: call it with the cell definition.
2) If `options.targets` map contains any matching name: use that element.
3) Search for `document.querySelector('[data-cell="<name>"]')` for each name alias.
4) If no match:
   - if `appendUnmatched` true, append to `#notebook-root` or container
   - otherwise skip

Note on view cells:
- Decide whether the `mount()` is routing **cells** or **observable variable emissions**.
  - The runtime observer callback is variable-based, not cell-based.
  - To make `data-cell` cell-based, `mount()` should route only the *primary display variable* for each cell (e.g. route `"viewof one"` for view cells, and suppress/ignore the derived `"one"` output by default).
  - Provide an option like `showValues: boolean` if you ever need to render both.

Acceptance:
- With a template containing `[data-cell="one"]`, `one` renders into that node without any switch statement.

### Phase 4 — update README example to be declarative and robust

Replace the switch-based example with:

- a template snippet:
  - `<div data-cell="one"></div>`, `<div data-cell="other"></div>`, `<div data-cell="out"></div>`
- a JS entry point that calls `mount()`.

Also document fallbacks:
- unnamed cells land in `#notebook-root` or container
- `cell:<id>` targeting is always available

Acceptance:
- The example works without enumerating `"viewof ..."` in user code.

### Phase 5 — (optional) CLI/template workflow

If this repo is going to become closer to your `offline-bundler` flow, add:

- `--template <file>` CLI option that merges a template with the generated script/style.
- auto-mount behavior when `[data-cell]` exists.

This is larger scope and may belong in a separate tool, but the earlier phases make it possible.

---

## Practical “next” recommendation

If the goal is to get rid of the flaky `switch(name)` routing as quickly as possible while staying aligned with this repo:

1) Scope parsing to `<notebook>`.
2) Generate and export `cells` metadata with `names`.
3) Add `mount()` that routes via `[data-cell]` and falls back cleanly.
4) Update the README example to use `data-cell` instead of the switch.

That’s the smallest change set that delivers the template targeting UX you described.
