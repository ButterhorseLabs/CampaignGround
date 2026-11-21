import { useState } from "react";
import { toast } from "sonner";

interface RunOptions {
  onSuccess?: () => void;
  failTitle?: string;
  /** Override the default failure toast, e.g. to read an error message out of the response body. */
  onError?: (r: Response) => void | Promise<void>;
}

/**
 * Generic skeleton behind the "save dialog" pattern repeated across the app:
 * flip a saving flag, run a fetch, toast on failure, call onSuccess on
 * success. Field state, validation, and reset lists stay in each dialog.
 */
export function useSavingAction() {
  const [saving, setSaving] = useState(false);

  async function run(action: () => Promise<Response>, opts?: RunOptions): Promise<boolean> {
    setSaving(true);
    let r: Response;
    try {
      r = await action();
    } catch {
      // fetch rejects when the request never reached the server (offline, dead zone).
      // The dialog stays open with everything typed, so trying again is one tap.
      toast.error("No connection", { description: "Nothing was saved. Your entry is still here; try again when you have signal." });
      return false;
    } finally {
      setSaving(false);
    }
    if (r.ok) {
      opts?.onSuccess?.();
    } else if (opts?.onError) {
      await opts.onError(r);
    } else {
      toast.error(opts?.failTitle ?? "Something went wrong");
    }
    return r.ok;
  }

  return { saving, run };
}
