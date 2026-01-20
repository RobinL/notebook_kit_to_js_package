This library works well, but suffers from a problem

The notebook format it expects deviates from the official format of notebook-kit notebooks

The mechanism we are using for placement is incorrect (we use data-name=).

The official format supports doing this correctly using both an id and a output.

OURS:
<script type="module" data-name="one">
    const one = view(Inputs.text({ label: "one", value: "robin jabba" }));

    ({ one })
</script>

HOW IT SHOULD BE DONE
<script type="module" id="2" output="one">
    const one = view(Inputs.text({ label: "one", value: "robin jabba" }));

    ({ one })
</script>
Note: the output tag is optional

--

Here's an example of a notebook in the canonical format:

<!doctype html>
<notebook theme="air">
    <title>Untitled</title>
    <script id="1" type="text/markdown">
    ## find_me_easily
  </script>
    <script id="2" type="text/x-typescript" pinned="">
    const one = view(Inputs.text({label: "Text 1", value: "Hello World"}));
  </script>
    <script id="3" type="text/x-typescript" pinned="">
    const other = view(Inputs.text({label: "Text 2", value: "Hello Observable"}));
  </script>
    <script id="4" type="text/x-typescript" output="bliiip">
    import {diff_match_patch} from "diff-match-patch";

    const dmp = new diff_match_patch();
    const diffs = dmp.diff_main(one, other);
    dmp.diff_cleanupSemantic(diffs);

    const diffHtml = diffs.map(([op, text]) => {
      const color = op === 1 ? 'green' : op === -1 ? 'red' : 'black';
      const bg = op === 1 ? '#e6ffe6' : op === -1 ? '#ffe6e6' : 'transparent';
      return `<span style="color: ${color}; background: ${bg}; padding: 2px 4px;">${text}</span>`;
    }).join('');

    const out = document.createElement('div');
    out.style.fontFamily = 'monospace';
    out.style.padding = '10px';
    out.innerHTML = diffHtml;

    display(out);
  </script>
</notebook>


And the canonical build process results lots of stuff, but here's how it transpiles the cell metadata

Command: notebooks build --root notebooks --no-minify --template notebooks/minimal.tmpl -- notebooks/*.html

define(
  {
    root: document.getElementById(`cell-2`),
    expanded: [],
    variables: []
  },
  {
    id: 2,
    body: (view, Inputs2) => {
      const one = view(Inputs2.text({ label: "Text 1", value: "Hello World" }));
      return { one };
    },
    inputs: ["view", "Inputs"],
    outputs: ["one"],
    output: void 0,
    assets: void 0,
    autodisplay: false,
    autoview: void 0,
    automutable: void 0
  }
);
define(
  {
    root: document.getElementById(`cell-3`),
    expanded: [],
    variables: []
  },
  {
    id: 3,
    body: (view, Inputs2) => {
      const other = view(Inputs2.text({ label: "Text 2", value: "Hello Observable" }));
      return { other };
    },
    inputs: ["view", "Inputs"],
    outputs: ["other"],
    output: void 0,
    assets: void 0,
    autodisplay: false,
    autoview: void 0,
    automutable: void 0
  }
);
define(
  {
    root: document.getElementById(`cell-4`),
    expanded: [],
    variables: []
  },
  {
    id: 4,
    body: async (one, other, display2) => {
      const { diff_match_patch } = await __vitePreload(() => import("./index-qOFrmpmy.js").then((n) => n.i), true ? [] : void 0, import.meta.url).then((module) => {
        if (!("diff_match_patch" in module)) throw new SyntaxError(`export 'diff_match_patch' not found`);
        return module;
      });
      const dmp = new diff_match_patch();
      const diffs = dmp.diff_main(one, other);
      dmp.diff_cleanupSemantic(diffs);
      const diffHtml = diffs.map(([op, text2]) => {
        const color = op === 1 ? "green" : op === -1 ? "red" : "black";
        const bg = op === 1 ? "#e6ffe6" : op === -1 ? "#ffe6e6" : "transparent";
        return `<span style="color: ${color}; background: ${bg}; padding: 2px 4px;">${text2}</span>`;
      }).join("");
      const out = document.createElement("div");
      out.style.fontFamily = "monospace";
      out.style.padding = "10px";
      out.innerHTML = diffHtml;
      display2(out);
      return { diff_match_patch, dmp, diffs, diffHtml, out };
    },
    inputs: ["one", "other", "display"],
    outputs: ["diff_match_patch", "dmp", "diffs", "diffHtml", "out"],
    output: "bliiip",
    assets: void 0,
    autodisplay: false,
    autoview: void 0,
    automutable: void 0
  }
);



YOUR INSTRUCTIONS:

I want you to upgrade all the code to make the whole thing adhere to the correct notebook spec and get rid of data-name.  Update the demo notebook first, then update all the code.

Remember that data-name was a way for the end user to map outputs to containers

I want the end user to be able to direct outpus to containers in three seaparate ways:
- by reference to cell id
- by reference to cell output if set (e.g. bliip)
- by reference to one of the members of outputs

