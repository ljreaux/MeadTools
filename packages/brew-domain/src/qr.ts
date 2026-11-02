import { renderSVG } from "uqr";
import { brewQrUrl } from "./links";

export type BrewQrResult =
  | { error: "unavailable" | "premiumRequired" | "failed" }
  | { svg: string; url: string; filename: string };

/** Authentication adapters supply identity; every generation checks current access. */
export async function generateOwnedBrewQr(
  brewId: string,
  access: {
    publicBaseUrl: string;
    ownsBrew: (brewId: string) => Promise<boolean>;
    premiumEnabled: () => Promise<boolean>;
  },
): Promise<BrewQrResult> {
  let url: string;
  try {
    url = brewQrUrl(brewId, access.publicBaseUrl);
  } catch {
    return { error: "unavailable" };
  }
  // Avoid revealing whether another account's brew exists or its entitlement.
  if (!(await access.ownsBrew(brewId))) return { error: "unavailable" };
  if (!(await access.premiumEnabled())) return { error: "premiumRequired" };
  return {
    url,
    filename: `meadtools-brew-${brewId}-qr.svg`,
    // Four light modules form the quiet zone. Q tolerates wear on printed labels.
    svg: renderSVG(url, { ecc: "Q", border: 4, pixelSize: 12, whiteColor: "#ffffff", blackColor: "#000000" }),
  };
}
