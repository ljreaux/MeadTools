import type { PremiumAccessResponse } from "@meadtools/api-contract/contracts";

export function shouldShowPremiumLaunchNotice(options: {
  signedIn: boolean;
  dismissed: boolean;
  onPremiumPage: boolean;
  status?: Pick<PremiumAccessResponse, "subscriptionsEnabled" | "entitled" | "paymentRestricted">;
}) {
  return options.signedIn && !options.dismissed && !options.onPremiumPage &&
    options.status?.subscriptionsEnabled === true &&
    !options.status.entitled && !options.status.paymentRestricted;
}
