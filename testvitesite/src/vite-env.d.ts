/// <reference types="vite/client" />

declare module "hello-world-diff-match-patch-demo" {
    export function mount(
        container: HTMLElement,
        options?: unknown
    ): { runtime: { dispose(): void } };
}

declare module "my-custom-lib" {
    export default function hello_world(): string;
}
