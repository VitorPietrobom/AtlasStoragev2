let counter = 0;

function fallbackId(): string {
  counter = (counter + 1) % 1_000_000;
  return Date.now().toString(36) + counter.toString(36).padStart(4, '0') + Math.random().toString(36).slice(2, 10);
}

let generator: () => string = fallbackId;

/** The app swaps in a crypto UUID; tests can make ids deterministic. */
export function setIdGenerator(fn: () => string): void {
  generator = fn;
}

export function newId(): string {
  return generator();
}
