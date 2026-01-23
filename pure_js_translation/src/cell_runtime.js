import { Runtime as ObservableRuntime } from "@observablehq/runtime";
import { Inspector } from "@observablehq/inspector";
import { Library } from "@observablehq/stdlib";
import * as Inputs from "@observablehq/inputs";

export { Inspector, Library, Inputs };

export function createLibrary() {
    const library = new Library();
    return Object.assign(library, { Inputs });
}

export class Runtime extends ObservableRuntime {
    constructor(builtins = createLibrary()) {
        super(builtins);
    }
}

// ============================================================================
// Generators.input (vendored minimal helper from notebook-kit)
// ============================================================================

function observeGenerator(initialize) {
    let dispose;
    let done = false;
    const queue = [];
    let notify;

    function enqueue(item) {
        queue.push(item);
        if (notify) {
            notify();
            notify = null;
        }
    }

    async function next() {
        if (done) return { value: undefined, done: true };
        if (!dispose) {
            dispose = initialize(
                (value) => enqueue({ type: "value", value }),
                (error) => enqueue({ type: "error", error })
            );
        }
        while (!queue.length) {
            await new Promise((r) => (notify = r));
            if (done) return { value: undefined, done: true };
        }
        const item = queue.shift();
        if (item.type === "error") throw item.error;
        return { value: item.value, done: false };
    }

    return {
        next,
        return() {
            done = true;
            if (dispose) dispose();
            if (notify) {
                notify();
                notify = null;
            }
            return Promise.resolve({ value: undefined, done: true });
        },
        [Symbol.asyncIterator]() {
            return this;
        }
    };
}

function inputGenerator(element) {
    return observeGenerator((change) => {
        const event = eventof(element);
        const value = valueof(element);
        const inputted = () => change(valueof(element));
        element.addEventListener(event, inputted);
        if (value !== undefined) change(value);
        return () => element.removeEventListener(event, inputted);
    });
}

function valueof(element) {
    const input = element;
    const select = element;
    if ("type" in element) {
        switch (element.type) {
            case "range":
            case "number":
                return input.valueAsNumber;
            case "date":
                return input.valueAsDate;
            case "checkbox":
                return input.checked;
            case "file":
                return input.multiple ? input.files : input.files[0];
            case "select-multiple":
                return Array.from(select.selectedOptions, (o) => o.value);
        }
    }
    return input.value;
}

function eventof(element) {
    if ("type" in element) {
        switch (element.type) {
            case "button":
            case "submit":
            case "checkbox":
                return "click";
            case "file":
                return "change";
        }
    }
    return "input";
}

// ============================================================================
// Display runtime (vendored from notebook-kit)
// ============================================================================

function displayValue(state, value) {
    const { root } = state;
    let node;

    if (isDisplayable(value, root)) {
        node = value;
    } else {
        const div = document.createElement("div");
        new Inspector(div).fulfilled(value);
        node = div;
    }

    if (node.nodeType === 11) {
        let child;
        while ((child = node.firstChild)) {
            root.appendChild(child);
        }
    } else {
        root.appendChild(node);
    }
}

function isDisplayable(value, root) {
    return (
        (value instanceof Element || value instanceof Text) &&
        value instanceof value.constructor &&
        (!value.parentNode || root.contains(value))
    );
}

function clearRoot(state) {
    state.autoclear = false;
    while (state.root.lastChild) state.root.lastChild.remove();
}

function createObserver(state, cellMeta) {
    return {
        _error: false,
        pending() {
            if (this._error) {
                this._error = false;
                clearRoot(state);
            }
        },
        fulfilled(value) {
            if (cellMeta.autodisplay) {
                clearRoot(state);
                displayValue(state, value);
            } else if (state.autoclear) {
                clearRoot(state);
            }
        },
        rejected(error) {
            console.error(error);
            this._error = true;
            clearRoot(state);
            const div = document.createElement("div");
            new Inspector(div).rejected(error);
            state.root.appendChild(div);
        }
    };
}

function getBodyFn(cellMeta, cellBodies) {
    if (!cellBodies) return undefined;
    if (cellMeta.bodyKey && cellMeta.bodyKey in cellBodies) return cellBodies[cellMeta.bodyKey];
    if (cellMeta.id in cellBodies) return cellBodies[cellMeta.id];
    const fallbackKey = `cell_${String(cellMeta.id).replace(/[^a-zA-Z0-9]/g, "_")}`;
    return cellBodies[fallbackKey];
}

function defineCell(main, state, cellMeta, bodyFn) {
    const { id, inputs = [], outputs = [], output, autodisplay } = cellMeta;

    if (!state.root && (inputs.includes("display") || inputs.includes("view"))) {
        throw new Error(`Cell ${id} requests display/view but has render=false`);
    }

    const vid = output ?? (outputs.length ? "cell " + id : null);
    const observer = state.root ? createObserver(state, cellMeta) : true;
    const v = state.root ? main.variable(observer, { shadow: {} }) : main.variable(true);

    state.autoclear = true;

    if (state.root && (inputs.includes("display") || inputs.includes("view"))) {
        let displayVersion = -1;
        const vd = new (v.constructor)(2, v._module);

        vd.define(
            inputs.filter((i) => i !== "display" && i !== "view"),
            () => {
                const version = v._version;
                return (value) => {
                    if (version < displayVersion) throw new Error("stale display");
                    else if (state.variables[0] !== v) throw new Error("stale display");
                    else if (version > displayVersion) clearRoot(state);
                    displayVersion = version;
                    displayValue(state, value);
                    return value;
                };
            }
        );

        v._shadow.set("display", vd);

        if (inputs.includes("view")) {
            const vv = new (v.constructor)(2, v._module, null, { shadow: {} });
            vv._shadow.set("display", vd);
            vv.define(["display"], (display) => (value) => inputGenerator(display(value)));
            v._shadow.set("view", vv);
        }
    } else if (state.root && !autodisplay) {
        clearRoot(state);
    }

    state.variables.push(v.define(vid, inputs, bodyFn));

    if (output == null) {
        for (const o of outputs) {
            state.variables.push(main.variable(true).define(o, [vid], (exports) => exports?.[o]));
        }
    }
}

/**
 * Mount a code-first "cells + cellBodies" notebook.
 *
 * - Each cell may render to an existing root element (cellMeta.rootId)
 * - If missing, a root is created and appended to container
 * - display()/view() are supported (notebook-kit style)
 */
export function mountCells(
    { cells, cellBodies },
    {
        container = document.body,
        rootIdPrefix = "cell-",
        runtime = new Runtime(),
    } = {}
) {
    const main = runtime.module();

    for (const cellMeta of cells) {
        const render = cellMeta.render !== false;

        let root = null;
        if (render) {
            const rootId = cellMeta.rootId ?? `${rootIdPrefix}${cellMeta.id}`;
            const existing = document.getElementById(rootId);
            root = existing ?? document.createElement("div");
            root.classList.add("observablehq", "observablehq--cell");
            if (!existing) {
                root.id = rootId;
                container.appendChild(root);
            }
        }

        const state = {
            root,
            variables: [],
            autoclear: true,
            version: 0,
        };

        const bodyFn = getBodyFn(cellMeta, cellBodies);
        if (bodyFn) defineCell(main, state, cellMeta, bodyFn);
    }

    return { runtime, main };
}
