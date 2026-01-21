import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))
const workspaceRoot = path.resolve(projectRoot, '..')

const testLibEntry = path.resolve(workspaceRoot, 'test-lib/src/index.js')
const customLibEntry = path.resolve(workspaceRoot, 'test-notebooks/my-custom-lib/index.js')

export default defineConfig({
    resolve: {
        preserveSymlinks: true,
        alias: {
            // Treat these as source files (not cached prebundled deps)
            'hello-world-diff-match-patch-demo': testLibEntry,
            'my-custom-lib': customLibEntry
        }
    },
    server: {
        fs: {
            allow: [workspaceRoot]
        }
    },
    optimizeDeps: {
        // Avoid prebundling local packages (prebundle cache is what usually forces rm -rf node_modules/.vite)
        exclude: ['hello-world-diff-match-patch-demo', 'my-custom-lib']
    }
})
