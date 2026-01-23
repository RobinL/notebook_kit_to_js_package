// Pure JavaScript - no notebook HTML, no transpilation needed!
// This achieves the same reactivity as hello.html but written directly.

import { Runtime, Library } from "@observablehq/runtime";
import { Inspector } from "@observablehq/inspector";
import * as Inputs from "@observablehq/inputs";

// Create a runtime with standard library + Inputs
const library = Object.assign(new Library(), { Inputs });
const runtime = new Runtime(library);
const main = runtime.module();

// Helper: create a view that returns a generator (for reactive inputs)
function viewGenerator(element) {
    return observeGenerator((change) => {
        const event = element.type === "checkbox" ? "click" : "input";
        const getValue = () => {
            if (element.type === "number" || element.type === "range") return element.valueAsNumber;
            if (element.type === "checkbox") return element.checked;
            return element.value;
        };
        element.addEventListener(event, () => change(getValue()));
        change(getValue());
        return () => element.removeEventListener(event, () => change(getValue()));
    });
}

function observeGenerator(initialize) {
    let dispose, done = false;
    const queue = [];
    let notify;
    function enqueue(item) {
        queue.push(item);
        if (notify) { notify(); notify = null; }
    }
    return {
        async next() {
            if (done) return { done: true };
            if (!dispose) dispose = initialize((v) => enqueue({ value: v }));
            while (!queue.length) await new Promise(r => notify = r);
            return queue.shift();
        },
        return() { done = true; dispose?.(); return { done: true }; },
        [Symbol.asyncIterator]() { return this; }
    };
}

// ============================================================================
// Define your reactive cells - this is the Observable runtime API directly
// ============================================================================

// Cell: Text input "one"
main.variable(new Inspector(document.getElementById("cell-one")))
    .define("one", ["Inputs"], (Inputs) => {
        return Inputs.text({ label: "one", value: "robin jabba" });
    });

// Cell: Text input "other"
main.variable(new Inspector(document.getElementById("cell-other")))
    .define("other", ["Inputs"], (Inputs) => {
        return Inputs.text({ label: "other", value: "roin liinacre" });
    });

// Cell: Diff output - depends on "one" and "other" (reactive!)
main.variable(new Inspector(document.getElementById("cell-diff")))
    .define("diff", ["one", "other"], async (one, other) => {
        const { default: DiffMatchPatch } = await import("diff-match-patch");
        const dmp = new DiffMatchPatch();
        const diffs = dmp.diff_main(one, other);

        const out = document.createElement("div");
        out.style.fontSize = "16px";
        out.style.lineHeight = "1.6";
        out.innerHTML = dmp.diff_prettyHtml(diffs);

        // Return a fragment with multiple elements
        const frag = document.createDocumentFragment();
        frag.appendChild(out);
        const dist = document.createElement("div");
        dist.textContent = `Levenshtein distance: ${dmp.diff_levenshtein(diffs)}`;
        frag.appendChild(dist);
        return frag;
    });

// Cell: Vega spec (pure data, no DOM)
main.variable().define("spec", [], () => ({
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    description: "Match weight distribution",
    data: {
        values: [
            { match_weight: 5.5, count: 4 },
            { match_weight: 4.5, count: 1 }
        ],
    },
    mark: "bar",
    encoding: {
        x: { field: "match_weight", type: "nominal", title: "Match weight" },
        y: { aggregate: "count", type: "quantitative", title: "Count" },
    },
    params: [{
        name: "selectBar",
        select: { type: "point", on: "click", fields: ["match_weight"] }
    }]
}));

// Cell: Vega chart - depends on spec
main.variable(new Inspector(document.getElementById("cell-chart")))
    .define("chartView", ["spec", "invalidation"], async (spec, invalidation) => {
        const { default: vegaEmbed } = await import("vega-embed");
        const container = document.createElement("div");
        const result = await vegaEmbed(container, spec, { actions: false });
        invalidation.then(() => result.finalize());
        return result.view;
    });

// Cell: Selected bar - observes Vega signal (reactive!)
main.variable().define("selectedBar", ["Generators", "chartView"], (Generators, chartView) => {
    return Generators.observe((notify) => {
        const listener = (_name, value) => notify(value);
        chartView.addSignalListener("selectBar", listener);
        notify(chartView.signal("selectBar"));
        return () => chartView.removeSignalListener("selectBar", listener);
    });
});

// Cell: Display selected weight - updates reactively when selection changes
main.variable(new Inspector(document.getElementById("cell-selected")))
    .define("selectedDisplay", ["selectedBar"], (selectedBar) => {
        return `Your selected weight is: ${selectedBar?.match_weight?.[0] ?? "—"}`;
    });

export { runtime, main };
