/**
 * Shim for @tanstack/react-start useServerFn hook.
 * Maps the TanStack Start style calls (e.g. fn({ data: args }))
 * to direct client fetch helper calls (e.g. fn(args)).
 */
export function useServerFn<TArgs, TResponse>(
  fn: (args: TArgs) => Promise<TResponse>
): (variables?: { data: TArgs }) => Promise<TResponse> {
  return (variables?: { data: TArgs }) => {
    if (variables && typeof variables === "object" && "data" in variables) {
      return fn(variables.data);
    }
    return fn(variables as unknown as TArgs);
  };
}
