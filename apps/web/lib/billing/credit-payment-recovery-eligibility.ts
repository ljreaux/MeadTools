/** A payment restriction can clear only after every review case is resolved. */
export function canReleasePaymentRestrictedChat(options: {
  releaseRequested: boolean;
  unresolvedRecoveryCount: number;
  availableCredits: number;
}): boolean {
  return (
    options.releaseRequested &&
    options.unresolvedRecoveryCount === 0 &&
    options.availableCredits >= 0
  );
}
