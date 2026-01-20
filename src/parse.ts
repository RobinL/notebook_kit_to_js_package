import { JSDOM } from "jsdom";
import slugify from "@sindresorhus/slugify";

export interface RawCell {
    id: string;           // from id attribute (required in canonical format)
    index: number;        // 0-based stable index for fallback
    output?: string;      // from output attribute (optional - for targeting)
    source: string;
    language: "js" | "markdown" | "html" | "tex";
}

export function parseNotebookHtml(html: string): RawCell[] {
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    const cells: RawCell[] = [];

    // Prefer scripts inside <notebook> element; fall back to all scripts if absent
    const notebookEl = doc.querySelector("notebook");
    const scriptContainer = notebookEl || doc;
    const scripts = scriptContainer.querySelectorAll("script");

    let indexCounter = 0;
    let autoIdCounter = 0;

    scripts.forEach((script) => {
        const type = script.getAttribute("type");
        // Use id attribute (canonical format), or generate one if missing
        const id = script.getAttribute("id") || `auto-${++autoIdCounter}`;
        const output = script.getAttribute("output") || undefined;
        const source = script.textContent || "";

        if (type === "module") {
            cells.push({ id, index: indexCounter++, output, source, language: "js" });
        } else if (type === "text/markdown") {
            cells.push({ id, index: indexCounter++, output, source, language: "markdown" });
        } else if (type === "text/html") {
            cells.push({ id, index: indexCounter++, output, source, language: "html" });
        }
    });

    return cells;
}

/**
 * Infer a safe library name from the <title> tag
 */
export function parseLibraryName(html: string): string {
    const dom = new JSDOM(html);
    const title = dom.window.document.querySelector("title")?.textContent;
    return slugify(title || "notebook-library");
}
