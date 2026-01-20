import { transpileJavaScript } from "@observablehq/notebook-kit";
import { rewriteImports } from "./rewrite.js";

export interface TranspiledCell {
    id: number;
    index: number;  // 0-based stable index for cell:<index> fallback
    name?: string;
    body: string;      // The function body
    inputs: string[];  // Variables this cell needs
    outputs: string[]; // Variables this cell defines (generation-time overrides)
    dependencies: Set<string>; // npm packages used
    viewName?: string; // If set, this cell defines `viewof ${viewName}` and we should synthesize `${viewName}` via Generators.input
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Remove common leading whitespace from all lines (dedent).
 * This handles indented content inside HTML <script> blocks.
 */
function dedent(text: string): string {
    const lines = text.split("\n");
    // Find minimum indentation (ignoring blank lines)
    let minIndent = Infinity;
    for (const line of lines) {
        if (line.trim().length === 0) continue;
        const match = line.match(/^(\s*)/);
        if (match && match[1].length < minIndent) {
            minIndent = match[1].length;
        }
    }
    if (minIndent === Infinity || minIndent === 0) return text.trim();
    // Remove that many spaces from each line
    return lines.map(line => line.slice(minIndent)).join("\n").trim();
}

export function processCell(
    id: number,
    index: number,
    source: string,
    language: "js" | "markdown" | "html" | "tex",
    name?: string
): TranspiledCell {

    let jsSource = source;

    // Detect notebook-kit view() usage before we rewrite it away.
    // In notebook-kit HTML exports, form elements are typically wrapped as:
    //   const <name> = view(Inputs.*(...))
    // Semantically, this means the cell defines a *view* and the runtime should provide:
    //   viewof <name>  -> the element
    //   <name>         -> Generators.input(viewof <name>)
    const isViewCell = Boolean(
        name && new RegExp(`\\b(?:const|let|var)\\s+${escapeRegExp(name)}\\s*=\\s*view\\s*\\(`).test(source)
    );

    // Convert non-JS blocks to template literals for the runtime
    // Dedent to remove HTML indentation that would otherwise create code blocks
    if (language === "markdown") {
        const content = dedent(source);
        jsSource = `md\`${content.replace(/`/g, "\\`")}\``;
    } else if (language === "html") {
        const content = dedent(source);
        jsSource = `html\`${content.replace(/`/g, "\\`")}\``;
    } else if (language === "js") {
        // notebook-kit HTML exports rely on helper globals that aren't present in standard JS.
        // We rewrite them away so the generated define.js becomes standard Observable Runtime code.
        // - view(expr)    -> (expr)
        // - display(expr) -> void (expr)
        // The Runtime + Inspector will take care of display, and viewof/value is handled via Generators.input.
        jsSource = jsSource
            .replace(/\bview\s*\(/g, "(")
            .replace(/\bdisplay\s*\(/g, "void (");
    }

    // 1. Rewrite imports (npm: -> bare) and collect deps
    const { cleanedSource, dependencies } = rewriteImports(jsSource);

    // 2. Transpile OJS to JS using Notebook Kit
    const transpiled = transpileJavaScript(cleanedSource, {
        resolveLocalImports: false,
        resolveFiles: false
    });

    // notebook-kit transpileJavaScript tends to over-report outputs for these HTML exports
    // (e.g. it may include internal locals). Prefer the notebook's declared cell name.
    const outputs: string[] = [];
    let viewName: string | undefined;
    if (name) {
        if (isViewCell) {
            viewName = name;
            outputs.push(`viewof ${name}`);
        } else {
            outputs.push(name);
        }
    }

    return {
        id,
        index,
        name,
        body: transpiled.body,
        inputs: transpiled.inputs || [],
        outputs,
        dependencies,
        viewName
    };
}
