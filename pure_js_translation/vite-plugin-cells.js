/**
 * Vite plugin that auto-infers inputs/outputs for Observable-style cells.
 *
 * How it works:
 * 1. When you import a `*.notebook.js` file, this plugin intercepts it
 * 2. It parses each exported `cell_*` function using acorn
 * 3. Inputs = function parameter names (explicit dependencies)
 * 4. Outputs = keys in the return statement's object literal
 * 5. It generates `cells` metadata and `cellBodies` automatically
 */

import * as acorn from "acorn";
import * as walk from "acorn-walk";
import path from "path";

/**
 * Analyze a function to extract:
 * - inputs: the function's parameter names
 * - outputs: keys of the returned object (if it returns { key1, key2, ... })
 * - autodisplay: true if no outputs and doesn't use display/view
 */
function analyzeCell(fnSource) {
    // Parse the function as an expression
    let ast;
    try {
        // Wrap in parens to parse as expression
        ast = acorn.parse(`(${fnSource})`, {
            ecmaVersion: 2022,
            sourceType: "module",
        });
    } catch (e) {
        console.warn("Failed to parse cell:", e.message);
        return { inputs: [], outputs: [], autodisplay: false };
    }

    const expr = ast.body[0].expression;
    if (!expr || (expr.type !== "FunctionExpression" && expr.type !== "ArrowFunctionExpression")) {
        return { inputs: [], outputs: [], autodisplay: false };
    }

    // Extract parameter names as inputs
    const inputs = expr.params.map((p) => {
        if (p.type === "Identifier") return p.name;
        if (p.type === "AssignmentPattern" && p.left.type === "Identifier") return p.left.name;
        return null;
    }).filter(Boolean);

    // Find outputs from return statements
    const outputs = [];
    walk.simple(expr.body, {
        ReturnStatement(node) {
            if (node.argument && node.argument.type === "ObjectExpression") {
                for (const prop of node.argument.properties) {
                    if (prop.type === "Property" && prop.key.type === "Identifier") {
                        if (!outputs.includes(prop.key.name)) {
                            outputs.push(prop.key.name);
                        }
                    }
                }
            }
        },
    });

    // Determine autodisplay
    const usesDisplay = inputs.includes("display");
    const usesView = inputs.includes("view");
    const hasOutputs = outputs.length > 0;
    const autodisplay = !usesDisplay && !usesView && !hasOutputs;

    return { inputs, outputs, autodisplay };
}

/**
 * Parse a notebook source file and generate cells + cellBodies.
 */
function transformNotebook(source, id) {
    // Parse the module to find exported cell_* functions
    let ast;
    try {
        ast = acorn.parse(source, {
            ecmaVersion: 2022,
            sourceType: "module",
        });
    } catch (e) {
        console.error("Failed to parse notebook:", e.message);
        return source;
    }

    const cellExports = [];
    const cellMeta = {};

    // Find all `export const cell_N = ...` declarations
    for (const node of ast.body) {
        if (node.type === "ExportNamedDeclaration" && node.declaration) {
            const decl = node.declaration;
            if (decl.type === "VariableDeclaration") {
                for (const d of decl.declarations) {
                    if (d.id.type === "Identifier" && d.id.name.startsWith("cell_")) {
                        const name = d.id.name;
                        const cellId = name.replace("cell_", "");
                        const fnStart = d.init.start;
                        const fnEnd = d.init.end;
                        const fnSource = source.slice(fnStart, fnEnd);

                        cellExports.push({ name, cellId, fnSource, fnStart, fnEnd });
                    }
                }
            }
        }

        // Also look for property assignments like `cell_1.rootId = "..."`
        if (node.type === "ExpressionStatement" &&
            node.expression.type === "AssignmentExpression" &&
            node.expression.left.type === "MemberExpression" &&
            node.expression.left.object.type === "Identifier" &&
            node.expression.left.object.name.startsWith("cell_")) {

            const cellName = node.expression.left.object.name;
            const propName = node.expression.left.property.name;
            const propValue = node.expression.right;

            if (!cellMeta[cellName]) cellMeta[cellName] = {};

            if (propValue.type === "Literal") {
                cellMeta[cellName][propName] = propValue.value;
            } else if (propValue.type === "Identifier" && propValue.name === "false") {
                cellMeta[cellName][propName] = false;
            } else if (propValue.type === "Identifier" && propValue.name === "true") {
                cellMeta[cellName][propName] = true;
            }
        }
    }

    // Sort by cell number
    cellExports.sort((a, b) => {
        const numA = parseInt(a.cellId, 10) || 0;
        const numB = parseInt(b.cellId, 10) || 0;
        return numA - numB;
    });

    // Generate cells array and cellBodies
    const cells = [];
    const cellBodiesEntries = [];

    for (let i = 0; i < cellExports.length; i++) {
        const { name, cellId, fnSource } = cellExports[i];
        const { inputs, outputs, autodisplay } = analyzeCell(fnSource);
        const meta = cellMeta[name] || {};

        const cell = {
            id: cellId,
            index: i,
            inputs,
            outputs,
            autodisplay,
        };

        // Add optional metadata
        if (meta.rootId) cell.rootId = meta.rootId;
        if (meta.output) cell.output = meta.output;
        if (meta.render === false) cell.render = false;

        cells.push(cell);
        cellBodiesEntries.push(`  "${cellId}": ${name}`);
    }

    // Generate the transformed module
    const generatedCode = `
// ============================================================================
// AUTO-GENERATED by vite-plugin-cells
// Inputs/outputs inferred from function signatures and return statements
// ============================================================================

${source}

export const cells = ${JSON.stringify(cells, null, 2)};

export const cellBodies = {
${cellBodiesEntries.join(",\n")}
};
`;

    return generatedCode;
}

/**
 * Vite plugin factory
 */
export default function cellsPlugin() {
    return {
        name: "vite-plugin-cells",

        transform(source, id) {
            // Only transform *.notebook.js files
            if (!id.endsWith(".notebook.js")) {
                return null;
            }

            console.log(`[vite-plugin-cells] Analyzing ${path.basename(id)}...`);
            const transformed = transformNotebook(source, id);
            return {
                code: transformed,
                map: null,
            };
        },
    };
}
