#!/usr/bin/env node
import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import { parseNotebookHtml, parseLibraryName } from "../src/parse.js";
import { processCell, type TranspiledCell } from "../src/transpile.js";
import { generateDefineJs, generateIndexJs, generatePackageJson, generateReadme, generateRuntimeJs } from "../src/generate.js";

function toPosixPath(p: string): string {
    return p.split(path.sep).join("/");
}

function loadNotebookDependencySpecs(inputPath: string, outDir: string): Record<string, string> {
    const dir = path.dirname(inputPath);
    const base = path.basename(inputPath, path.extname(inputPath));

    // Prefer a notebook-specific file to avoid accidentally treating the folder as an npm package.
    const candidates = [
        path.join(dir, `${base}.package.json`),
        path.join(dir, "package.json")
    ];

    let pkgPath: string | null = null;
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            pkgPath = candidate;
            break;
        }
    }

    if (!pkgPath) return {};

    try {
        const raw = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        const deps: Record<string, string> = raw?.dependencies && typeof raw.dependencies === "object" ? raw.dependencies : {};

        const pkgDir = path.dirname(pkgPath);
        const rewritten: Record<string, string> = {};

        for (const [name, spec] of Object.entries(deps)) {
            if (typeof spec !== "string") continue;

            // Rewrite local file: specs so they're correct from the generated outDir.
            if (spec.startsWith("file:")) {
                const target = spec.slice("file:".length);
                const absTarget = target.startsWith("/")
                    ? target
                    : path.resolve(pkgDir, target);
                const relFromOut = path.relative(outDir, absTarget);
                const normalized = relFromOut.startsWith(".") ? relFromOut : `./${relFromOut}`;
                rewritten[name] = `file:${toPosixPath(normalized)}`;
            } else {
                rewritten[name] = spec;
            }
        }

        return rewritten;
    } catch {
        console.warn(`Warning: Failed to parse dependency overrides in ${pkgPath}`);
        return {};
    }
}

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
        const inferredDependencySpecs: Record<string, string> = {};

        for (const cell of rawCells) {
            try {
                const processed = processCell(cell.id, cell.index, cell.source, cell.language, cell.name);
                processedCells.push(processed);
                processed.dependencies.forEach(d => allDependencies.add(d));
                Object.assign(inferredDependencySpecs, processed.dependencySpecs);
            } catch (err) {
                console.warn(`Warning: Failed to transpile cell ${cell.id}:`, err);
            }
        }

        // 3. Generate Output
        const outDir = path.resolve(options.out || path.join(process.cwd(), libName));
        const srcDir = path.join(outDir, "src");

        // Load notebook-local dependency pinning/overrides (if any).
        // Precedence: explicit notebook specs > inferred npm:pkg@version hints
        const notebookDependencySpecs = loadNotebookDependencySpecs(inputPath, outDir);
        const dependencySpecs = { ...inferredDependencySpecs, ...notebookDependencySpecs };

        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir, { recursive: true });

        console.log(`Generating files in ${outDir}...`);

        fs.writeFileSync(path.join(srcDir, "define.js"), generateDefineJs(processedCells));
        fs.writeFileSync(path.join(srcDir, "runtime.js"), generateRuntimeJs());
        fs.writeFileSync(path.join(srcDir, "index.js"), generateIndexJs());
        fs.writeFileSync(path.join(outDir, "package.json"), generatePackageJson(libName, allDependencies, dependencySpecs));
        fs.writeFileSync(path.join(outDir, "README.md"), generateReadme(libName));

        console.log("Done! To use:");
        console.log(`  cd ${outDir}`);
        console.log(`  npm install`);
    });

program.parse();
