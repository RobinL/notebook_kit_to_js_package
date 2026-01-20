#!/usr/bin/env node
import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import { parseNotebookHtml, parseLibraryName } from "../src/parse.js";
import { processCell, type TranspiledCell } from "../src/transpile.js";
import { generateDefineJs, generateIndexJs, generatePackageJson, generateReadme, generateRuntimeJs } from "../src/generate.js";

const program = new Command();

program
    .name("notebook-to-lib")
    .description("Convert an Observable notebook HTML file to a JavaScript library")
    .argument("<input-file>", "Path to notebook.html")
    .option("-o, --out <dir>", "Output directory")
    .action((inputFile, options) => {
        const inputPath = path.resolve(inputFile);

        if (!fs.existsSync(inputPath)) {
            console.error(`Error: File not found: ${inputPath}`);
            process.exit(1);
        }

        const html = fs.readFileSync(inputPath, "utf-8");

        // 1. Parse
        console.log("Parsing HTML...");
        const rawCells = parseNotebookHtml(html);
        const libName = parseLibraryName(html);

        // 2. Transpile & Analyze
        console.log(`Transpiling ${rawCells.length} cells...`);
        const processedCells: TranspiledCell[] = [];
        const allDependencies = new Set<string>();

        for (const cell of rawCells) {
            try {
                const processed = processCell(cell.id, cell.index, cell.source, cell.language, cell.name);
                processedCells.push(processed);
                processed.dependencies.forEach(d => allDependencies.add(d));
            } catch (err) {
                console.warn(`Warning: Failed to transpile cell ${cell.id}:`, err);
            }
        }

        // 3. Generate Output
        const outDir = options.out || path.join(process.cwd(), libName);
        const srcDir = path.join(outDir, "src");

        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir, { recursive: true });

        console.log(`Generating files in ${outDir}...`);

        fs.writeFileSync(path.join(srcDir, "define.js"), generateDefineJs(processedCells));
        fs.writeFileSync(path.join(srcDir, "runtime.js"), generateRuntimeJs());
        fs.writeFileSync(path.join(srcDir, "index.js"), generateIndexJs());
        fs.writeFileSync(path.join(outDir, "package.json"), generatePackageJson(libName, allDependencies));
        fs.writeFileSync(path.join(outDir, "README.md"), generateReadme(libName));

        console.log("Done! To use:");
        console.log(`  cd ${outDir}`);
        console.log(`  npm install`);
    });

program.parse();
