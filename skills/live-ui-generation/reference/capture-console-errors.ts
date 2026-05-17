// Patches console.error at module load time to capture all errors.
// Eagerly imported by LiveUIProvider so it runs before React render.

const buffer: { message: string; stack: string; timestamp: number }[] = [];

const origConsoleError = console.error;
console.error = function (...args: any[]) {
  origConsoleError.apply(console, args);
  const error = args.find((a) => a instanceof Error);
  const message = args
    .map((a) =>
      typeof a === "object"
        ? a instanceof Error
          ? `${a.name}: ${a.message}`
          : JSON.stringify(a)
        : String(a)
    )
    .join(" ");
  buffer.push({
    message: message.slice(0, 500),
    stack: error?.stack?.slice(0, 2000) || "",
    timestamp: Date.now(),
  });
  if (buffer.length > 50) buffer.shift();
};

export function getConsoleErrorCount(): number {
  return buffer.length;
}

export function getCapturedConsoleErrors(
  mode: "minimal" | "detailed"
): { message: string; stack: string; timestamp: number }[] {
  if (mode === "detailed") return [...buffer];
  return buffer.map((e) => ({ message: e.message, stack: "", timestamp: e.timestamp }));
}
