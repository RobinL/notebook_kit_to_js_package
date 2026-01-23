// Code-first notebook runtime: author cells as data + functions.
import { mountCells } from "./cell_runtime.js";
import { cells, cellBodies } from "./hello_notebook.js";

const { runtime, main } = mountCells({ cells, cellBodies });

// Export for debugging in console
window.runtime = runtime;
window.main = main;

console.log("✅ Mounted code-first cells. Edit src/hello_notebook.js to iterate.");
