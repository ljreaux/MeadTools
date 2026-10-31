/** Fast rejection of explicit unrelated tasks, shared by hosted clients.
 * This is a conservative prefilter, not a semantic scope classifier. Requests
 * admitted by it still need the model's persistent brewing-only policy.
 */
const explicitOffTopicPattern =
  /\b(?:bitcoin|cryptocurrency|crypto(?:currency)?\s+trading|stock(?:s|\s+market)?|resignation\s+letter|capital\s+of|weather|movie|poem|homework|code\s+(?:a|an|the)|programming)\b/i;

// Explicit task pivots remain blocked even when wrapped in brewing language.
const unrelatedTaskPattern =
  /\b(?:plan|book)\s+(?:a\s+|my\s+)?(?:vacation|holiday|flight|trip)\b|\b(?:write|generate|debug)\s+(?:(?:some|a|an|the)\s+)?(?:python|javascript|typescript|sql|code)\b|\btranslate\b[\s\S]*\b(?:unrelated|train|vacation)\b|\b(?:recommend|buy|sell|trade)\b[\s\S]*\b(?:shares|stocks|bitcoin|crypto)\b/i;

// "Resume fermentation" is brewing language; reject clear resume-writing tasks.
const resumeTaskPattern = /\b(?:write|draft|create|edit|revise|update|polish|tailor|review|improve)\s+(?:me\s+)?(?:(?:a|an|my|the|this|your|our)\s+)?(?:job\s+)?(?:resume|résumé)(?=\s|[.!?,]|$)/i;

export function isExplicitlyUnrelatedBrewingRequest(message: string): boolean {
  return explicitOffTopicPattern.test(message) || unrelatedTaskPattern.test(message) || resumeTaskPattern.test(message);
}
