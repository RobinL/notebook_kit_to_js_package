// ============================================================================
// SIMPLIFIED AUTHORING: Just write your cell functions!
// The Vite plugin will auto-infer inputs (from params) and outputs (from return keys).
// ============================================================================

// Cell 1: Title (markdown)
export const cell_1 = (md) => {
    return md`# Hello, world! (diff-match-patch demo)

Type into the boxes to see a live demo here `;
};
cell_1.rootId = "cell-title";

// Cell 2: Input "one"
export const cell_2 = (view, Inputs) => {
    const one = view(Inputs.text({ label: "one", value: "robin linacre" }));
    return { one };
};
cell_2.rootId = "cell-one";

// Cell 3: Input "other"
export const cell_3 = (view, Inputs) => {
    const other = view(Inputs.text({ label: "other", value: "roin liinacre" }));
    return { other };
};
cell_3.rootId = "cell-other";

// Cell 4: Diff output
export const cell_4 = async (one, other, display) => {
    const { default: DiffMatchPatch } = await import("diff-match-patch");

    const dmp = new DiffMatchPatch();
    const diffs = dmp.diff_main(one, other);

    const out = document.createElement("div");
    out.style.fontSize = "16px";
    out.style.lineHeight = "1.6";
    out.innerHTML = dmp.diff_prettyHtml(diffs);

    display(out);
    display(`Levenshtein distance: ${dmp.diff_levenshtein(diffs)}`);

    return { DiffMatchPatch, dmp, diffs, out };
};
cell_4.rootId = "cell-diff";
cell_4.output = "diffOutput"; // named output for targeting

// Cell 5: Custom lib message
export const cell_5 = async (display) => {
    const { default: hello_world } = await import("my-custom-lib");

    const message = hello_world();
    display(message);
    display(message);

    return { hello_world, message };
};
cell_5.rootId = "cell-message";
cell_5.output = "message";

// Cell 6: Vega spec (no render - just data)
export const cell_6 = () => {
    const spec = {
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
    };

    return { spec };
};
cell_6.render = false; // Don't create a DOM element

// Cell 7: Vega chart
export const cell_7 = async (spec, display, invalidation) => {
    const { default: vegaEmbed } = await import("vega-embed");

    const container = document.createElement("div");
    const result = await vegaEmbed(container, spec, { actions: false });

    display(container);

    const chartView = result.view;
    invalidation.then(() => result.finalize());

    return { vegaEmbed, container, result, chartView };
};
cell_7.rootId = "cell-chart";

// Cell 8: Signal observer helper (no render)
export const cell_8 = (Generators) => {
    function observeVegaSignal(view, signalName) {
        return Generators.observe((notify) => {
            const listener = (_name, value) => notify(value);

            view.addSignalListener(signalName, listener);
            notify(view.signal(signalName));

            return () => view.removeSignalListener(signalName, listener);
        });
    }

    return { observeVegaSignal };
};
cell_8.render = false;

// Cell 9: Selected bar state (no render)
export const cell_9 = (observeVegaSignal, chartView) => {
    const selectedBar = observeVegaSignal(chartView, "selectBar");
    return { selectedBar };
};
cell_9.render = false;

// Cell 10: Selected bar display
export const cell_10 = (md, selectedBar) => {
    return md`Your selected weight is: **${selectedBar?.match_weight?.[0] ?? "—"}**

_Click a bar in the chart to select it!_`;
};
cell_10.rootId = "cell-selected";
