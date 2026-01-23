// Authoring surface: edit this file.
// It mirrors the structure of generated define.js (cells + cellBodies),
// but stays fully code-first (no notebook HTML, no transpilation).

export const cells = [
    {
        id: "1",
        rootId: "cell-title",
        inputs: ["md"],
        outputs: [],
        autodisplay: true,
    },
    {
        id: "2",
        rootId: "cell-one",
        inputs: ["view", "Inputs"],
        outputs: ["one"],
        autodisplay: false,
    },
    {
        id: "3",
        rootId: "cell-other",
        inputs: ["view", "Inputs"],
        outputs: ["other"],
        autodisplay: false,
    },
    {
        id: "4",
        rootId: "cell-diff",
        output: "diffOutput",
        inputs: ["one", "other", "display"],
        outputs: ["DiffMatchPatch", "dmp", "diffs", "out"],
        autodisplay: false,
    },
    {
        id: "5",
        rootId: "cell-message",
        output: "message",
        inputs: ["display"],
        outputs: ["hello_world", "message"],
        autodisplay: false,
    },
    {
        id: "6",
        render: false,
        inputs: [],
        outputs: ["spec"],
        autodisplay: false,
    },
    {
        id: "7",
        rootId: "cell-chart",
        inputs: ["spec", "display", "invalidation"],
        outputs: ["vegaEmbed", "container", "result", "chartView"],
        autodisplay: false,
    },
    {
        id: "8",
        render: false,
        inputs: ["Generators"],
        outputs: ["observeVegaSignal"],
        autodisplay: false,
    },
    {
        id: "9",
        render: false,
        inputs: ["observeVegaSignal", "chartView"],
        outputs: ["selectedBar"],
        autodisplay: false,
    },
    {
        id: "10",
        rootId: "cell-selected",
        inputs: ["md", "selectedBar"],
        outputs: [],
        autodisplay: true,
    },
];

export const cellBodies = {
    "1": (md) => {
        return md`# Hello, world! (diff-match-patch demo)

Type into the boxes to see a live demo here`;
    },

    "2": (view, Inputs) => {
        const one = view(Inputs.text({ label: "one", value: "robin jabba" }));
        ({ one });
        return { one };
    },

    "3": (view, Inputs) => {
        const other = view(Inputs.text({ label: "other", value: "roin liinacre" }));
        ({ other });
        return { other };
    },

    "4": async (one, other, display) => {
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
    },

    "5": async (display) => {
        const { default: hello_world } = await import("my-custom-lib");

        const message = hello_world();
        display(message);
        display(message);

        return { hello_world, message };
    },

    "6": () => {
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
    },

    "7": async (spec, display, invalidation) => {
        const { default: vegaEmbed } = await import("vega-embed");

        const container = document.createElement("div");
        const result = await vegaEmbed(container, spec, { actions: false });

        display(container);

        const chartView = result.view;
        invalidation.then(() => result.finalize());

        return { vegaEmbed, container, result, chartView };
    },

    "8": (Generators) => {
        function observeVegaSignal(view, signalName) {
            return Generators.observe((notify) => {
                const listener = (_name, value) => notify(value);

                view.addSignalListener(signalName, listener);
                notify(view.signal(signalName));

                return () => view.removeSignalListener(signalName, listener);
            });
        }

        return { observeVegaSignal };
    },

    "9": (observeVegaSignal, chartView) => {
        const selectedBar = observeVegaSignal(chartView, "selectBar");
        return { selectedBar };
    },

    "10": (md, selectedBar) => {
        return md`Your selected weight is: **${selectedBar?.match_weight?.[0] ?? "—"}**

_Click a bar in the chart to select it!_`;
    },
};
