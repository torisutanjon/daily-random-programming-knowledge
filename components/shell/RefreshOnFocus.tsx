"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-runs the server layout when the window comes back, so the shell never shows a stale day. */
export default function RefreshOnFocus(): null {
  const router = useRouter();
  useEffect(() => {
    const refresh = (): void => {
      if (document.visibilityState === "visible") router.refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);
  return null;
}
