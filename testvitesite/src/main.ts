import { mount } from "hello-world-diff-match-patch-demo";

let runtime = mount(document.getElementById("notebook")!).runtime;

if (import.meta.hot) {
    import.meta.hot.accept("hello-world-diff-match-patch-demo", (mod) => {
        if (!mod) return;
        const typed = mod as unknown as typeof import("hello-world-diff-match-patch-demo");
        runtime.dispose();
        runtime = typed.mount(document.getElementById("notebook")!).runtime;
    });

    import.meta.hot.dispose(() => {
        runtime.dispose();
    });
}
