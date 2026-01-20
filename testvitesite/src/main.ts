import { mount } from "hello-world-diff-match-patch-demo";

const { runtime } = mount(document.getElementById("notebook")!);

if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        runtime.dispose();
    });
}
