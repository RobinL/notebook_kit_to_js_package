import { JSDOM } from "jsdom";
import slugify from "@sindresorhus/slugify";

export interface RawCell {
    id: number;
    index: number; // 0-based stable index for cell:<index> fallback
    name?: string; // from data-name attribute
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

    let idCounter = 0;
    let indexCounter = 0;

    scripts.forEach((script) => {
        const type = script.getAttribute("type");
        const name = script.getAttribute("data-name") || undefined;
        const source = script.textContent || "";

        if (type === "module") {
            cells.push({ id: ++idCounter, index: indexCounter++, name, source, language: "js" });
        } else if (type === "text/markdown") {
            cells.push({ id: ++idCounter, index: indexCounter++, name, source, language: "markdown" });
        } else if (type === "text/html") {
            cells.push({ id: ++idCounter, index: indexCounter++, name, source, language: "html" });
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
