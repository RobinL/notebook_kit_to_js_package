// =============================================================================
// Pure JavaScript translation of hello.html
// No notebook format, no transpilation - just Observable Runtime API directly!
// =============================================================================

import { Runtime, Library } from "@observablehq/runtime";
import { Inspector } from "@observablehq/inspector";
import * as Inputs from "@observablehq/inputs";

// Create runtime with standard library + Inputs
const library = Object.assign(new Library(), { Inputs });
const runtime = new Runtime(library);
const main = runtime.module();

// -----------------------------------------------------------------------------
// Cell 1: Markdown title
// In notebook: md`# Hello, world!...`
// -----------------------------------------------------------------------------
main.variable(new Inspector(document.getElementById("cell-title")))
    .define("title", ["md"], (md) => {
        return md`# Hello, world! (diff-match-patch demo)

Type into the boxes to see a live demo here`;
    });

// -----------------------------------------------------------------------------
// Cell 2: Text input "one"
// In notebook: const one = view(Inputs.text(...))
// -----------------------------------------------------------------------------
main.variable(new Inspector(document.getElementById("cell-one")))
    .define("oneView", ["Inputs"], (Inputs) => {
        return Inputs.text({ label: "one", value: "robin jabba" });
    });

// Reactive value of the input (string)
main.variable()
    .define("one", ["Generators", "oneView"], (Generators, oneView) => Generators.input(oneView));

// -----------------------------------------------------------------------------
// Cell 3: Text input "other"
// In notebook: const other = view(Inputs.text(...))
// -----------------------------------------------------------------------------
main.variable(new Inspector(document.getElementById("cell-other")))
    .define("otherView", ["Inputs"], (Inputs) => {
        return Inputs.text({ label: "other", value: "roin liinacre" });
    });

// Reactive value of the input (string)
main.variable()
    .define("other", ["Generators", "otherView"], (Generators, otherView) => Generators.input(otherView));

// -----------------------------------------------------------------------------
// Cell 4: Diff output - REACTIVE! Re-runs when "one" or "other" change
// In notebook: import DiffMatchPatch...; display(out); display(distance)
// -----------------------------------------------------------------------------
main.variable(new Inspector(document.getElementById("cell-diff")))
    .define("diffOutput", ["one", "other"], async (one, other) => {
        const { default: DiffMatchPatch } = await import("diff-match-patch");

        const dmp = new DiffMatchPatch();
        const diffs = dmp.diff_main(one, other);

        const out = document.createElement("div");
        out.style.fontSize = "16px";
        out.style.lineHeight = "1.6";
        out.innerHTML = dmp.diff_prettyHtml(diffs);

        // Return a DOM Element (Inspector can render Elements, but not DocumentFragment nicely)
        const wrapper = document.createElement("div");
        wrapper.appendChild(out);

        const distDiv = document.createElement("div");
        distDiv.style.marginTop = "0.5rem";
        distDiv.style.color = "#666";
        distDiv.textContent = `Levenshtein distance: ${dmp.diff_levenshtein(diffs)}`;
        wrapper.appendChild(distDiv);

        return wrapper;
    });

// -----------------------------------------------------------------------------
// Cell 6: Vega-Lite spec (pure data, no DOM output needed)
// -----------------------------------------------------------------------------
main.variable()
    .define("spec", [], () => ({
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        description: "Match weight distribution",
        data: {
            values: [
                { match_weight: 5.5, count: 4 },
                { match_weight: 4.5, count: 1 },
            ],
        },
        mark: "bar",
        encoding: {
            x: { field: "match_weight", type: "nominal", title: "Match weight" },
            y: { aggregate: "count", type: "quantitative", title: "Count" },
        },
        params: [
            {
                name: "selectBar",
                select: { type: "point", on: "click", fields: ["match_weight"] },
            },
        ],
    }));

// -----------------------------------------------------------------------------
// Cell 7: Vega chart - depends on spec, exports chartView
// -----------------------------------------------------------------------------
main.variable(new Inspector(document.getElementById("cell-chart")))
    .define("chartView", ["spec", "invalidation"], async (spec, invalidation) => {
        const { default: vegaEmbed } = await import("vega-embed");

        const container = document.createElement("div");
        const result = await vegaEmbed(container, spec, { actions: false });

        // Clean up when cell is invalidated (re-run)
        invalidation.then(() => result.finalize());

        // Return the container for display, but also expose result.view
        // We'll define chartView separately to get the view object
        container._vegaView = result.view;
        return container;
    });

// Extract the Vega view from the container for signal observation
main.variable()
    .define("vegaView", ["chartView"], (container) => container._vegaView);

// -----------------------------------------------------------------------------
// Cell 8: observeVegaSignal helper function
// -----------------------------------------------------------------------------
main.variable()
    .define("observeVegaSignal", ["Generators"], (Generators) => {
        return function observeVegaSignal(view, signalName) {
            return Generators.observe((notify) => {
                const listener = (_name, value) => notify(value);

                view.addSignalListener(signalName, listener);
                notify(view.signal(signalName)); // initial value

                return () => view.removeSignalListener(signalName, listener);
            });
        };
    });

// -----------------------------------------------------------------------------
// Cell 9: selectedBar - observes Vega signal (REACTIVE generator!)
// -----------------------------------------------------------------------------
main.variable()
    .define("selectedBar", ["observeVegaSignal", "vegaView"], (observeVegaSignal, vegaView) => {
        return observeVegaSignal(vegaView, "selectBar");
    });

// -----------------------------------------------------------------------------
// Cell 10: Display selected weight - updates reactively
// -----------------------------------------------------------------------------
main.variable(new Inspector(document.getElementById("cell-selected")))
    .define("selectedDisplay", ["md", "selectedBar"], (md, selectedBar) => {
        return md`Your selected weight is: **${selectedBar?.match_weight?.[0] ?? "—"}**

_Click a bar in the chart to select it!_`;
    });

// Export for debugging in console
window.runtime = runtime;
window.main = main;

console.log("✅ Notebook mounted! Try window.main to inspect the module.");
