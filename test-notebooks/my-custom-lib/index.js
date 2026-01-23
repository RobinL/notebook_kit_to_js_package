// my-custom-lib - a simple test library
export default function hello_world() {
    return "Hello from my-custom-lib!";
}

function observe_chart_data(chart, signal_name) {
    return Generators.observe(function (notify) {
        const signaled = (name, value) => notify(value);
        chart.addSignalListener(signal_name, signaled);

        notify(chart.signal(signal_name));

        return () => chart.removeSignalListener(signal_name, signaled);
    });
}
export { observe_chart_data };