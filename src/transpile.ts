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
    viewName?: string;     // If set, this cell defines `viewof ${viewName}` and we should synthesize `${viewName}` via Generators.input
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

    // Detect notebook-kit view() usage. Look for pattern: const <name> = view(...)
    // We'll use the first such match as the view name
    const viewMatch = source.match(/\b(?:const|let|var)\s+(\w+)\s*=\s*view\s*\(/);
    const viewName = viewMatch ? viewMatch[1] : undefined;

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
    const { cleanedSource, dependencies, dependencySpecs } = rewriteImports(jsSource);

    // 2. Transpile OJS to JS using Notebook Kit
    const transpiled = transpileJavaScript(cleanedSource, {
        resolveLocalImports: false,
        resolveFiles: false
    });

    // Build the outputs array
    // notebook-kit transpileJavaScript returns outputs, but we prefer deriving from view detection
    const outputs: string[] = [];
    if (viewName) {
        outputs.push(`viewof ${viewName}`);
    } else if (transpiled.outputs && transpiled.outputs.length > 0) {
        // Use transpiled outputs for non-view cells
        outputs.push(...transpiled.outputs);
    }

    return {
        id,
        index,
        output,
        body: transpiled.body,
        inputs: transpiled.inputs || [],
        outputs,
        dependencies,
        dependencySpecs,
        viewName
    };
}
