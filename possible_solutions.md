# Findings: `display()` and why our output differs from notebook-kit

## What the canonical notebook-kit build does

Notebook-kit’s Vite exporter generates code that calls its own runtime `define(...)` for each cell, and **each cell gets its own `root` DOM node** (e.g. `document.getElementById(`cell-4`)`). See the emitter in [notebook-kit/src/vite/observable.ts](notebook-kit/src/vite/observable.ts#L181-L247).

That runtime `define()`:

- Creates a single runtime variable for the cell (the “cell variable”), observed into that cell’s `root`.
- If the cell’s `inputs` include `display` (or `view`), it injects a **cell-scoped `display` function** via the variable’s `shadow` mechanism. See [notebook-kit/src/runtime/define.ts](notebook-kit/src/runtime/define.ts#L32-L90).
- `display(state, value)` appends a Node (or an inspected representation) into `state.root`. Multiple calls append multiple children. See [notebook-kit/src/runtime/display.ts](notebook-kit/src/runtime/display.ts#L1-L56).

This is important: in canonical notebook-kit, `display(...)` is **not** “the value of the cell”; it’s an imperative rendering hook that appends into the cell’s root.

## Why *your* example only shows the first `display(...)`

In our converter we rewrote `display(expr)` into `void (expr)`.

That means:

- `display(out)` no longer renders anything.
- However, you still see the formatted HTML because `out` is a returned output variable (`return { …, out }`), and our current runtime renders variables via `Inspector`.
- The string `display(`Levenshtein distance: ...`)` is *not* returned as an output variable in the cell’s export object, so there’s nothing for our runtime to render.

So the behavior you’re seeing is consistent with our current (non-notebook-kit) semantics: we are rendering only **declared outputs**, not **imperative displays**.

## Why our `targets` differs from canonical

Canonical notebook-kit placement is fundamentally **cell-root based**:

- Each cell renders into exactly one root (the element with id `cell-${id}`), and that root is what contains:
  - any `display(...)` calls (possibly multiple)
  - any autodisplayed single result (when `autodisplay` is enabled)

In contrast, our implementation tried to route **individual variables** to containers by building a global `targets` list from:

- `cell-{id}`
- the cell’s `output` attribute
- every member of `outputs`

That’s not how notebook-kit works: notebook-kit doesn’t use variable names as a placement key.

## The ambiguity problem (duplicate output names)

You’re right: “target by output member” can be ambiguous.

Example: many cells can define `out`, `chart`, `data`, `viewof something`, etc. In canonical notebook-kit, this is not a placement problem because placement is per-cell-root, not per variable name.

If we keep “target by output name” as a feature, we need an ambiguity rule.

# Suggested solutions

## Option A (Recommended): adopt notebook-kit’s runtime model for rendering

Goal: behave like canonical notebook-kit builds.

Changes:

1. Stop rewriting away `display(...)`.
2. Generate a small runtime wrapper that implements notebook-kit’s `define()` + `display()` (we can vendor the tiny subset of code from:
   - [notebook-kit/src/runtime/define.ts](notebook-kit/src/runtime/define.ts)
   - [notebook-kit/src/runtime/display.ts](notebook-kit/src/runtime/display.ts)
   )
3. Render per-cell (one root per cell), not per variable.

Implications:

- Cells that call `display(...)` will work correctly (multiple display calls show multiple outputs).
- Placement becomes unambiguous because it’s fundamentally “place cell X here”.
- We can still expose outputs as variables for dependency wiring, but rendering is driven by the cell root.

How targeting would work:

- Primary key is still the target element; we just need to decide which *cell* goes into which element.
- Support exactly what you asked for, but at the **cell level**:
  - by cell id: `cell-4`
  - by cell output attribute (if present): `bliiip`
  - by output member (only as a selector to find the cell)

## Option B: keep Observable runtime module, but emulate display by converting displays into outputs

This keeps the current “render output variables with Inspector” model, but tries to recover notebook-kit-style display behavior.

Approach:

- Transform `display(x)` into collecting a list: `__displays.push(x)`.
- Add a synthetic output (e.g. `__display`) which returns a DOM node that contains all displayed values in order.

Downsides:

- This is not canonical notebook-kit semantics.
- It changes evaluation order and what the cell exports.
- It’s awkward for multiple targets or streaming updates.

## Option C: ambiguity-safe output-name targeting rules (if you insist on it)

If you want `data-cell="out"` to work, we need one of:

1. **Uniqueness requirement**: if multiple cells match, throw/warn and render none.
2. **First match wins**: deterministic but surprising.
3. **Qualified selector**: require disambiguation, e.g.
   - `data-cell="cell-4/out"`
   - or `data-cell="output:bliiip"` / `data-cell="id:4"` / `data-cell="var:out"`

Canonical notebook-kit avoids this entirely by targeting the cell root.

# Proposed next steps (practical)

1. Update our converter/runtime to render per-cell-root (Option A).
2. Keep the three targeting modes, but treat “output member” as a *selector for a cell*, not as a stable placement key for a variable.
3. Add a clear ambiguity error message when a variable name matches multiple cells.
