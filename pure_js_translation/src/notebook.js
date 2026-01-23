// Code-first notebook runtime: author cells as data + functions.
import { mountCells } from "./cell_runtime.js";

// Import from the .notebook.js file - the Vite plugin auto-generates cells metadata!
import { cells, cellBodies } from "./hello.notebook.js";

const { runtime, main } = mountCells({ cells, cellBodies });

// Export for debugging in console
window.runtime = runtime;
window.main = main;

console.log("✅ Mounted code-first cells (inputs/outputs auto-inferred).");
console.log("Cells:", cells);
