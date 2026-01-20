import { transpileJavaScript } from "@observablehq/notebook-kit";
import { rewriteImports } from "./rewrite.js";

export interface TranspiledCell {
    id: number;
    name?: string;
    body: string;      // The function body
    inputs: string[];  // Variables this cell needs
    outputs: string[]; // Variables this cell defines
    dependencies: Set<string>; // npm packages used
}

export function processCell(
    id: number,
    source: string,
    language: "js" | "markdown" | "html" | "tex",
    name?: string
): TranspiledCell {

    let jsSource = source;

    // Convert non-JS blocks to template literals for the runtime
    if (language === "markdown") {
        jsSource = `md\`${source.replace(/`/g, "\\`")}\``;
    } else if (language === "html") {
        jsSource = `html\`${source.replace(/`/g, "\\`")}\``;
    }

    // 1. Rewrite imports (npm: -> bare) and collect deps
    const { cleanedSource, dependencies } = rewriteImports(jsSource);

    // 2. Transpile OJS to JS using Notebook Kit
    const transpiled = transpileJavaScript(cleanedSource, {
        resolveLocalImports: false,
        resolveFiles: false
    });

    return {
        id,
        name,
        body: transpiled.body,
        inputs: transpiled.inputs || [],
        outputs: transpiled.outputs || [],
        dependencies
    };
}
