// One shared 30-day notice window, rather than 30 days per visitor.
export const RAPT_CLOUD_NOTICE_EXPIRES_AT = Date.parse("2026-11-16T16:52:51.000Z");

export function shouldShowRaptCloudNotice({
  isLoggedIn,
  dismissed,
  now = Date.now(),
}: {
  isLoggedIn: boolean;
  dismissed: boolean;
  now?: number;
}) {
  return isLoggedIn && !dismissed && now < RAPT_CLOUD_NOTICE_EXPIRES_AT;
}
