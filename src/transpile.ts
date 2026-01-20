import { transpileJavaScript } from "@observablehq/notebook-kit";
import { rewriteImports } from "./rewrite.js";

export interface TranspiledCell {
    id: string;            // from id attribute (canonical format)
    index: number;         // 0-based stable index for fallback
    output?: string;       // from output attribute (for targeting)
    body: string;          // The function body
    inputs: string[];      // Variables this cell needs
    outputs: string[];     // Variables this cell defines (generation-time overrides)
    dependencies: Set<string>; // npm packages used
    dependencySpecs: Record<string, string>; // package -> version/range/tag (from npm: imports)
    autodisplay: boolean;  // Whether to auto-display the cell's return value
    usesDisplay: boolean;  // Whether the cell uses display() (needs shadow variable injection)
    usesView: boolean;     // Whether the cell uses view() (needs shadow variable injection)
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
    id: string,
    index: number,
    source: string,
    language: "js" | "markdown" | "html" | "tex",
    output?: string
): TranspiledCell {

    let jsSource = source;

    // Convert non-JS blocks to template literals for the runtime
    // Dedent to remove HTML indentation that would otherwise create code blocks
    if (language === "markdown") {
        const content = dedent(source);
        jsSource = `md\`${content.replace(/`/g, "\\`")}\``;
    } else if (language === "html") {
        const content = dedent(source);
        jsSource = `html\`${content.replace(/`/g, "\\`")}\``;
    }
    // For JS: DO NOT rewrite view() or display() - they will be provided by shadow variables at runtime

    // 1. Rewrite imports (npm: -> bare) and collect deps
    const { cleanedSource, dependencies, dependencySpecs } = rewriteImports(jsSource);

    // 2. Transpile OJS to JS using Notebook Kit
    const transpiled = transpileJavaScript(cleanedSource, {
        resolveLocalImports: false,
        resolveFiles: false
    });

    // notebook-kit determines display/view needs by whether they appear in inputs.
    const inputs = transpiled.inputs || [];
    const usesDisplay = inputs.includes("display");
    const usesView = inputs.includes("view");

    // Build the outputs array (use notebook-kit's own declaration analysis).
    // Note: notebook-kit’s view() helper does NOT imply `viewof ...` outputs; it returns a value-generator.
    const outputs: string[] = transpiled.outputs && transpiled.outputs.length > 0 ? [...transpiled.outputs] : [];

    // Determine autodisplay:
    // - If cell uses display() or view(), autodisplay is false (explicit display calls handle rendering)
    // - If cell has outputs (is a "program" with declarations), autodisplay is false
    // - If cell is a simple expression (no outputs, no display/view), autodisplay is true
    const hasDeclarations = outputs.length > 0;
    const autodisplay = !usesDisplay && !usesView && !hasDeclarations;

    return {
        id,
        index,
        output,
        body: transpiled.body,
        inputs,
        outputs,
        dependencies,
        dependencySpecs,
        autodisplay,
        usesDisplay,
        usesView
    };
}
