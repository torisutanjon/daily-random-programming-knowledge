export type ProviderFailure = "auth" | "unavailable" | "rejected" | "refused";

export class ProviderError extends Error {
  readonly reason: ProviderFailure;

  constructor(reason: ProviderFailure, options?: { cause?: unknown }) {
    super(PROVIDER_ERRORS[reason].message, options);
    this.name = "ProviderError";
    this.reason = reason;
  }
}

/** HTTP code + user-facing message per failure; every route returns 502 { error: { code, message } }. */
export const PROVIDER_ERRORS: Record<ProviderFailure, { code: string; message: string }> = {
  auth: { code: "invalid_key", message: "Your API key was rejected — check it in Settings." },
  unavailable: { code: "provider_unavailable", message: "Claude is unavailable right now — try again." },
  rejected: { code: "provider_rejected", message: "Claude rejected the request — check the model in Settings." },
  refused: { code: "refused", message: "Claude declined this request — try again." },
};
