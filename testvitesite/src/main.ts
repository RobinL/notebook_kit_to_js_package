import { mount } from "hello-world-diff-match-patch-demo";




let runtime = mount(document.getElementById("notebook")!).runtime;

if (import.meta.hot) {
    import.meta.hot.accept("my-custom-lib", (mod) => {
        el.textContent = mod.default();
    });

    import.meta.hot.accept("hello-world-diff-match-patch-demo", (mod) => {
        runtime.dispose();
        runtime = mod.mount(document.getElementById("notebook")!).runtime;
    });

    import.meta.hot.dispose(() => {
        runtime.dispose();
    });
}
