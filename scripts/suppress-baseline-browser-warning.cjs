const originalWarn = console.warn;

console.warn = (...args) => {
  const [message] = args;

  if (
    typeof message === "string" &&
    message.startsWith("[baseline-browser-mapping]")
  ) {
    return;
  }

  originalWarn.apply(console, args);
};
