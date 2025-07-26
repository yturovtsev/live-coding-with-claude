export function debounce<TArgs extends readonly unknown[], TReturn>(
  func: (...args: TArgs) => TReturn,
  wait: number
): (...args: TArgs) => void {
  let timeout: ReturnType<typeof setTimeout>;

  return (...args: TArgs) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
