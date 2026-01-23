# notebook-to-lib

> Convert Observable notebook-kit HTML files into reusable JavaScript libraries

## Overview

**notebook-to-lib** transforms Observable notebook-kit notebooks into standard npm packages that export Observable Runtime compatible modules. Instead of bundling everything into a single HTML file, this tool creates a proper JavaScript library with dependencies managed through npm.

### Why Use This?

- **Reusable Components**: Convert notebooks into libraries that can be imported in other projects
- **Standard Tooling**: Leverage npm for dependency management and standard ES modules
- **Clean Integration**: Use notebook code in larger applications without bundling complexity
- **Simple Implementation**: ~400 lines of code vs 2000+ for a bundler approach
- **Active Development**: Perfect for sharing notebook logic and building on top of notebook work

## Features

✅ **Smart Import Detection**: Automatically finds `npm:package` and bare specifier imports
✅ **Dependency Management**: Generates `package.json` with all detected dependencies
✅ **Observable Runtime Compatible**: Output works seamlessly with `@observablehq/runtime`
✅ **TypeScript Built**: Full TypeScript implementation with type safety
✅ **Multiple Outputs Handling**: Correctly handles cells with multiple variable definitions
✅ **Markdown Support**: Preserves markdown cells with proper `md` template literals

## Installation

```bash
npm install
npm run build
```

## Quick Start

### 1. Convert a Notebook

```bash
# Using npm script
npm run test

# Or directly with tsx
npx tsx bin/convert.ts <input-notebook.html> --out <output-directory>

# Example
npx tsx bin/convert.ts test-notebooks/hello.html --out my-lib
```

### 2. Install Dependencies

```bash
cd my-lib
npm install
```

### 3. Use in Your Project

```javascript
import { mount } from "my-lib";

// notebook-kit-style rendering (one DOM root per cell)
const { runtime } = mount(document.getElementById("notebook"));

// Later:
// runtime.dispose();
```

## Demo (Vite + live reload)

This repo includes a Vite demo app in `testvitesite/` that mounts the generated
package (`test-lib/`) and is configured for reliable hot reload when you edit
the notebook source.

One-time setup:

```bash
npm install
npm --prefix testvitesite install
```

Run the live demo:

```bash
npm run demo
```

What `npm run demo` does:

- Watches `test-notebooks/**/*.html` and adjacent `*.package.json` / `package.json`
- Rebuilds `test-lib/` on change (`npm run test`) and reinstalls its deps
- Starts Vite (`testvitesite`) with aliases so local packages are treated as source

You can run the pieces separately:

```bash
npm run demo:watch  # just rebuild on notebook changes
npm run demo:vite   # just run the Vite dev server
```

## Directing Output to Containers (Layout)

This project now mirrors notebook-kit’s placement model:

- Output is rendered **per cell**, not per variable.
- Each cell renders into a DOM element with id `cell-<id>` (for example `cell-4`).
- `mount(container)` will **reuse** any existing `#cell-<id>` elements; if a cell root is missing, it will create and append it under `container`.

### Option A: Provide cell containers in your HTML (recommended)

Put the cell roots exactly where you want them to appear:

```html
<div id="notebook">
  <h2>Inputs</h2>
  <div id="cell-2"></div>
  <div id="cell-3"></div>

  <h2>Diff</h2>
  <div id="cell-4"></div>

  <h2>Message</h2>
  <div id="cell-5"></div>
</div>
```

Then mount:

```js
import { mount } from "my-lib";
mount(document.getElementById("notebook"));
```

### Option B: Let mount() create containers automatically

If you don’t create any `#cell-<id>` elements, `mount(document.body)` will append them in document order at the end of the container.

### Finding cell ids

- Cell ids come from the notebook HTML’s `<script id="…">` attributes.
- The generated package also exports `cells` metadata you can inspect to see ids and any `output="..."` names.

## What `display()` Does

`display(value)` is not “the return value of the cell”. It is an **imperative rendering hook** scoped to the current cell:

- It appends rendered output into that cell’s root element (`#cell-<id>`).
- Multiple calls append multiple outputs (e.g. `display(out); display("…")`).
- On re-evaluation, the cell root is cleared at the start of the next render cycle (matching notebook-kit behavior).

If a cell does **not** call `display()` and is an expression cell, it may be **autodisplayed** (rendered automatically) depending on the notebook-kit transpiler’s `autodisplay` flag.

## How It Works

The conversion process involves four main steps:

```
Notebook HTML
    ↓ parse
Raw Cells
    ↓ transpile (notebook-kit)
Transpiled JavaScript
    ↓ analyze imports
Dependencies List
    ↓ generate
Library Package (with package.json)
    ↓ npm install
Ready to use with node_modules
```

### 1. **Parse**
Extracts cells from the notebook HTML file, identifying:
- Code cells (JavaScript/Observable JavaScript)
- Markdown cells
- Cell IDs from `id` attributes (canonical notebook-kit format)
- Cell output names from `output` attributes

### 2. **Transpile**
Uses `@observablehq/notebook-kit` to convert Observable JavaScript to standard JavaScript:
- Converts OJS syntax to standard JS
- Preserves cell relationships and dependencies
- Handles Observable-specific features

### 3. **Analyze & Rewrite**
Scans for dependencies and rewrites imports:
- `npm:d3` → `d3` (bare specifier)
- `npm:diff-match-patch` → `diff-match-patch`
- `npm:d3@7.9.0` → `d3` (and pins version to `7.9.0`)
- Detects already-bare specifiers like `"lodash"`
- Collects all dependencies for `package.json`

#### Optional: Pin versions / add explicit deps

By default, detected dependencies are added to the generated `package.json` with version `"latest"`.

If you want to **pin versions** (or include additional dependencies that aren't detectable via static imports), add a dependency file next to your notebook HTML:

- Preferred: `your-notebook.package.json`
- Also supported: `package.json` in the same folder as the notebook

Only the `dependencies` field is used. These specs override inferred ones.

`file:` dependencies are supported and will be rewritten to remain valid from the output directory.

#### Important: Peer Dependencies

Some packages (like `vega-embed`) declare peer dependencies that npm won't automatically install. You must **explicitly list all required dependencies** in your notebook's `.package.json` file.

For example, `vega-embed` requires both `vega` and `vega-lite` as peers:

```json
{
  "dependencies": {
    "vega": "^5.30.0",
    "vega-lite": "^5.21.0",
    "vega-embed": "^6.26.0"
  }
}
```

Check the package's documentation or npm warnings during `npm install` to identify peer dependencies.

### 4. **Generate**
Creates a complete npm package:
```
output-directory/
├── package.json         # Name, version, dependencies
├── README.md           # Usage instructions
└── src/
    ├── index.js        # Entry point (re-exports define)
    └── define.js       # Observable Runtime module definition
```

## Example Transformation

### Input: Notebook HTML

```html
<!doctype html>
<title>Simple Test</title>

<script type="text/markdown">
# Test Notebook
This is a simple test.
</script>

<script type="module">
import * as d3 from "npm:d3";
const data = [1, 2, 3, 4, 5];
const sum = d3.sum(data);
</script>

<script type="text/markdown">
The sum is ${sum}
</script>
```

### Output: JavaScript Package

**package.json**
```json
{
  "name": "simple-test",
  "version": "0.1.0",
  "description": "Converted Observable Notebook",
  "type": "module",
  "main": "src/index.js",
  "files": ["src"],
  "dependencies": {
    "@observablehq/runtime": "^5.0.0",
    "d3": "latest"
  }
}
```

**src/define.js**
```javascript
// Auto-generated by notebook-to-lib
export default function define(runtime, observer) {
  const main = runtime.module();

  main.variable(observer()).define(["md"], (md) => md`
    # Test Notebook
    This is a simple test.
  `);

  main.variable(observer("sum")).define("sum", ["d3"], async (d3) => {
    const data = [1, 2, 3, 4, 5];
    return d3.sum(data);
  });

  main.variable(observer()).define(["md","sum"], (md, sum) => md`
    The sum is ${sum}
  `);

  return main;
}
```

**src/index.js**
```javascript
export { default } from "./define.js";
```

## CLI Reference

```bash
npx tsx bin/convert.ts <input.html> [options]

Options:
  --out <directory>    Output directory for generated library
                       (default: derived from input filename)
```

## When to Use This vs a Bundler

| Feature | notebook-to-lib (This Tool) | Bundler Approach |
|---------|----------------------------|------------------|
| **Output** | JavaScript library package | Single HTML file |
| **Dependencies** | Managed by npm | Bundled into HTML |
| **Usage** | Import in other projects | Open HTML file in browser |
| **Complexity** | Simple (delegates to npm/JS) | Complex (shimming, bundling) |
| **File Size** | Small (deps separate) | Large (everything bundled) |
| **Offline** | Requires node_modules | Fully self-contained |
| **Reusability** | High (standard npm package) | Low (monolithic file) |

### Use notebook-to-lib when you want to:
- ✅ Create reusable components from notebooks
- ✅ Integrate notebook code into larger applications
- ✅ Leverage standard npm tooling
- ✅ Keep dependencies up-to-date independently
- ✅ Share code between multiple projects

### Use a bundler approach when you need:
- ✅ Completely self-contained HTML files
- ✅ No build step or npm dependencies
- ✅ Easy distribution (just share one file)
- ✅ Offline viewing without any setup
- ✅ Simple deployment (single file upload)

### Key Insight

The library approach is **much simpler** because it leverages existing infrastructure:
- npm handles dependency resolution
- Node.js/browsers handle module loading
- No need to shim FileAttachment, import.meta, etc.
- Standard Observable Runtime usage pattern

The bundler is **more complex** but produces **more portable** output.

## Project Structure

```
notebook-to-lib/
├── bin/
│   └── convert.ts          # CLI entry point
├── src/
│   ├── parse.ts            # HTML parsing logic
│   ├── transpile.ts        # OJS → JS conversion
│   ├── rewrite.ts          # Import detection & rewriting
│   └── generate.ts         # Package generation
├── test-notebooks/
│   ├── hello.html          # Complex test case
│   ├── simple-test.html    # Simple test case
│   └── my-custom-lib/      # Custom dependency example
├── test-lib/               # Generated from hello.html
├── simple-test-lib/        # Generated from simple-test.html
├── package.json
├── tsconfig.json
├── README.md               # This file
└── ARCHITECTURE.md         # Design comparison
```

## Testing

The repository includes test notebooks:

- **hello.html**: Complex notebook with markdown, Observable Inputs, external dependencies (diff-match-patch), and Vega-Lite charts
- **simple-test.html**: Basic notebook with D3 for simple testing

Run the conversion test:

```bash
npm run test
```

This generates `test-lib` and `simple-test-lib` directories with complete, installable packages.

## Requirements

### Build Requirements
- Node.js 18+
- TypeScript 5+

### Runtime Requirements (Generated Libraries)
- `@observablehq/runtime` (automatically added to dependencies)
- Any npm packages imported in the notebook
- A JavaScript environment (Node.js or browser with bundler)

## Implementation Details

### Key Design Decisions

1. **Delegation over Bundling**: Uses npm and standard module resolution instead of custom bundling
2. **No Shimming Required**: Doesn't need to fake `FileAttachment`, `import.meta`, etc.
3. **Simple Architecture**: ~400 lines of focused code instead of complex bundler configuration
4. **Observable Runtime Native**: Output is standard Observable Runtime module format

### Advantages

- **Simplicity**: Much easier to maintain than bundler approach
- **Standard Tooling**: Works with existing npm ecosystem
- **Reusability**: Output is a standard npm package
- **Maintainability**: Delegates complexity to existing, well-maintained tools

### Trade-offs

- Requires `npm install` (not standalone)
- Needs Node.js or bundler environment
- Not suitable for single-file distribution

## Contributing

This is a complete, working implementation. For modifications:

1. Edit TypeScript files in `src/` or `bin/`
2. Build: `npm run build`
3. Test: `npm run test`

## License

MIT

---

## Usage Examples

### Example 1: Simple Render (No Targeting)

The simplest way to render a notebook – just mount everything into a container:

**HTML:**
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Simple Notebook</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@observablehq/inspector@5/dist/inspector.css">
</head>
<body>
  <h1>My Notebook</h1>
  <div id="notebook"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

**main.js:**
```javascript
import { mount } from "hello-world-diff-match-patch-demo";

// Render everything into #notebook
mount(document.getElementById("notebook"));
```

That's it! All cells render in order inside `#notebook`.

---

### Example 2: Targeted Rendering with `data-cell`

For custom layouts, use `data-cell` attributes to place specific cells into specific DOM elements.

Cells can be targeted in three ways:
1. **By cell ID**: `data-cell="cell-2"` (matches `<script id="2">`)
2. **By output attribute**: `data-cell="diffOutput"` (matches `<script output="diffOutput">`)
3. **By output name**: `data-cell="one"` (matches cell that defines `one` or `viewof one`)

**Notebook HTML (canonical format):**
```html
<notebook>
    <script id="1" type="module">
        const one = view(Inputs.text({ label: "one", value: "robin" }));
        ({ one })
    </script>

    <script id="2" type="module">
        const other = view(Inputs.text({ label: "other", value: "Roin" }));
        ({ other })
    </script>

    <script id="3" type="module" output="diffResult">
        import DiffMatchPatch from "diff-match-patch";
        const dmp = new DiffMatchPatch();
        display(dmp.diff_prettyHtml(dmp.diff_main(one, other)));
    </script>
</notebook>
```

Then in your HTML template, use `data-cell` to target where each cell renders:

**HTML:**
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Custom Layout</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@observablehq/inspector@5/dist/inspector.css">
  <style>
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .card { padding: 1rem; border: 1px solid #ccc; border-radius: 8px; }
    .full-width { grid-column: 1 / -1; }
  </style>
</head>
<body>
  <h1>🔤 Diff Match Patch</h1>

  <div class="grid">
    <div class="card">
      <h3>Original Text</h3>
      <!-- Target by output name -->
      <div data-cell="one"></div>
    </div>

    <div class="card">
      <h3>Comparison Text</h3>
      <!-- Target by output name -->
      <div data-cell="other"></div>
    </div>
  </div>

  <div class="card full-width">
    <h3>Diff Result</h3>
    <!-- Target by output attribute OR by cell ID -->
    <div data-cell="diffResult"></div>
    <!-- Alternative: <div data-cell="cell-3"></div> -->
  </div>

  <!-- Container for any unmatched cells (e.g. markdown) -->
  <div id="notebook"></div>

  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

**main.js:**
```javascript
import { mount } from "hello-world-diff-match-patch-demo";

// Mount with data-cell targeting; unmatched cells go to #notebook
mount(document.getElementById("notebook"));
```

The `mount()` function automatically:
1. Finds matching `[data-cell="..."]` elements using any of the three targeting methods
2. Renders those cells into their targeted elements
3. Appends any unmatched cells (like markdown) to the container

---

### Example 3: Programmatic Targeting

You can also pass a `targets` map for programmatic control:

```javascript
import { mount } from "hello-world-diff-match-patch-demo";

mount(document.body, {
  targets: {
    // By output name
    "one": document.getElementById("target-one"),
    "other": document.getElementById("target-other"),
    // By output attribute
    "diffResult": document.getElementById("target-result"),
    // Or by cell ID
    "cell-3": document.getElementById("target-result"),
  },
  appendUnmatched: false  // Hide cells without explicit targets
});
```

---

### Example 4: Cell Targeting Reference

Every cell can be targeted by multiple identifiers:

| Targeting Method | Example | Matches |
|-----------------|---------|---------|
| Cell ID | `cell-2` | `<script id="2">` |
| Output attribute | `diffResult` | `<script output="diffResult">` |
| Output name | `one` | Cell that outputs `one` or `viewof one` |

```html
<!-- All of these work for a cell with id="2" that outputs "one" -->
<div data-cell="cell-2"></div>
<div data-cell="one"></div>
```

---

### Cleanup (for HMR / SPA)

The `mount()` function returns the runtime for cleanup:

```javascript
const { runtime } = mount(document.getElementById("notebook"));

// Later, when unmounting:
runtime.dispose();
```

In Vite HMR scenarios, you typically dispose + remount when the package module
itself updates:

```javascript
import { mount } from "hello-world-diff-match-patch-demo";

let runtime = mount(document.getElementById("notebook")!).runtime;

if (import.meta.hot) {
  import.meta.hot.accept("hello-world-diff-match-patch-demo", (mod) => {
    runtime.dispose();
    runtime = mod.mount(document.getElementById("notebook")!).runtime;
  });

  import.meta.hot.dispose(() => runtime.dispose());
}
```

---

**Created**: January 2026
**Built with**: TypeScript, @observablehq/notebook-kit, Observable Runtime
