import type { ReleaseEmailPreferencesUpdateBody } from "@meadtools/api-contract/contracts";

export type StoredPreferences = {
  web_opted_in_at: Date | null;
  mobile_opted_in_at: Date | null;
  chat_opted_in_at: Date | null;
  api_opted_in_at: Date | null;
};

export function releaseEmailResponse(row: StoredPreferences | null) {
  return {
    prompted: row !== null,
    web: Boolean(row?.web_opted_in_at),
    mobile: Boolean(row?.mobile_opted_in_at),
    chat: Boolean(row?.chat_opted_in_at),
    api: Boolean(row?.api_opted_in_at),
  };
}

export function consentDates(
  previous: StoredPreferences | null,
  requested: ReleaseEmailPreferencesUpdateBody,
  now: Date,
) {
  return {
    web_opted_in_at: requested.web ? (previous?.web_opted_in_at ?? now) : null,
    mobile_opted_in_at: requested.mobile
      ? (previous?.mobile_opted_in_at ?? now)
      : null,
    chat_opted_in_at: requested.chat
      ? (previous?.chat_opted_in_at ?? now)
      : null,
    api_opted_in_at: requested.api ? (previous?.api_opted_in_at ?? now) : null,
  };
}
