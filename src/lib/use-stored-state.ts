import { useCallback, useState } from "react";

const read = (key: string) => (typeof window === "undefined" ? "" : (localStorage.getItem(key) ?? ""));

/**
 * A string remembered in this browser under `key`, so a reload or a dropped
 * connection doesn't reset it. Switching keys (say, campaigns) reads that key's value.
 */
export function useStoredState(key: string): [string, (value: string) => void] {
  const [state, setState] = useState(() => ({ key, value: read(key) }));
  if (state.key !== key) setState({ key, value: read(key) });

  const set = useCallback(
    (value: string) => {
      setState({ key, value });
      localStorage.setItem(key, value);
    },
    [key]
  );
  return [state.key === key ? state.value : read(key), set];
}
