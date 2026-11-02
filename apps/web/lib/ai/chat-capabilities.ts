/**
 * Stable, user-facing capabilities for the MeadTools assistant.
 *
 * This deliberately stays deterministic instead of asking a provider to
 * describe the product. The same answer can be used by any MeadTools client
 * without a model call or an opportunity to over-promise functionality.
 */
export const assistantCapabilitiesAnswer = [
  "I can help you build and refine MeadTools recipe drafts, answer MeadTools brewing-process and troubleshooting questions, and point you to the right MeadTools calculator for exact calculations.",
  "I can find and read your saved recipes and brews by name, review their calculations and recorded brew history, and help revise an unsaved draft. Attaching a record is optional. Saving a recipe or logging a brew change requires your review and confirmation.",
  "I am not a general-purpose assistant, so I will keep the conversation focused on mead and MeadTools.",
].join("\n\n");

export function isAssistantCapabilitiesRequest(message: string): boolean {
  return /\b(?:what\s+(?:can|do)\s+you\s+(?:do|help\s+(?:with|me\s+(?:do|with)))|how\s+can\s+you\s+help|(?:your|the)\s+capabilit(?:y|ies)|what\s+is\s+this\s+(?:assistant|chat)\s+for)\b/i.test(
    message,
  );
}
