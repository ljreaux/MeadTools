"use client";

import { useAuth } from "@/hooks/auth/useAuth";
import { useReleaseEmails } from "@/hooks/reactQuery/useReleaseEmails";
import { ReleaseEmailPreferences } from "./ReleaseEmailPreferences";

export default function ReleaseEmailOptInBanner() {
  const { user } = useAuth();
  const { preferences } = useReleaseEmails();
  if (!user || !preferences.data || preferences.data.prompted) return null;

  return (
    <div className="border-b bg-background px-4 py-4 shadow-md">
      <div className="mx-auto max-w-[1200px]">
        <ReleaseEmailPreferences prompt />
      </div>
    </div>
  );
}
