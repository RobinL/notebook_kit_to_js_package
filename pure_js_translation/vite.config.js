import { defineConfig } from "vite";
import cellsPlugin from "./vite-plugin-cells.js";

export default defineConfig({
    plugins: [cellsPlugin()],
    optimizeDeps: {
        // Force esbuild to skip scanning .notebook.js files
        // (our plugin transforms them, but esbuild runs first)
        esbuildOptions: {
            plugins: [
                {
                    name: "ignore-notebook-files",
                    setup(build) {
                        build.onResolve({ filter: /\.notebook\.js$/ }, (args) => {
                            return { path: args.path, external: true };
                        });
                    },
                },
            ],
        },
    },
});
