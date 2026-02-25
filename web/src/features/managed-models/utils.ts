import type { ManagedModel } from "@langfuse/shared";

/**
 * Masks an API token for display purposes.
 * Shows first 4 and last 4 characters, masking the rest with asterisks.
 * Returns null if token is null/undefined, empty string if token is empty.
 */
export function maskApiToken(token: string | null | undefined): string | null {
  if (token === null || token === undefined) return null;
  if (token === "") return "";
  if (token.length <= 8) return "****";
  return token.slice(0, 4) + "****" + token.slice(-4);
}

/**
 * Converts a DB ManagedModel to API response format.
 * Replaces encrypted apiToken with masked displayApiToken.
 */
export function toApiManagedModel(model: ManagedModel) {
  const { apiToken, ...rest } = model;
  return {
    ...rest,
    displayApiToken: maskApiToken(apiToken),
  };
}
