import { defineConfig } from 'vite'

export default defineConfig({
    optimizeDeps: {
        include: ['hello-world-diff-match-patch-demo']
    }
})
