export function createTimer(fn, ms) {
  const handle = setTimeout(fn, ms);
  return {
    cancel: () => clearTimeout(handle),
  };
}
