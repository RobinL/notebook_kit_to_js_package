export interface ImportAnalysis {
    cleanedSource: string;
    dependencies: Set<string>;
}

// Regex to capture "npm:package" or "npm:package@version"
const NPM_IMPORT_REGEX = /["']npm:(@?[a-z0-9-._]+)(@[^"']*)?["']/g;

// Regex to capture bare specifiers in import statements
// Matches: import ... from "package" or import("package")
const IMPORT_FROM_REGEX = /(?:from|import\()\s*["']([^./"'][^"']*?)["']/g;

export function rewriteImports(source: string): ImportAnalysis {
    const dependencies = new Set<string>();

    // First, handle npm: prefixed imports and rewrite them
    let cleanedSource = source.replace(NPM_IMPORT_REGEX, (match, pkgName, version) => {
        dependencies.add(pkgName);
        return `"${pkgName}"`;
    });

    // Then detect all bare specifiers (including those already without npm: prefix)
    const importMatches = Array.from(cleanedSource.matchAll(IMPORT_FROM_REGEX));
    for (const match of importMatches) {
        const pkgName = match[1];
        // Filter out URLs and ensure it's a valid package name
        if (pkgName &&
            !pkgName.startsWith('http://') &&
            !pkgName.startsWith('https://') &&
            !pkgName.startsWith('.') &&
            !pkgName.startsWith('/')) {
            dependencies.add(pkgName);
        }
    }

    return { cleanedSource, dependencies };
}
