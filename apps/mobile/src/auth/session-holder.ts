import type { MobileSession } from "@/auth/session-storage";

/**
 * Holds the signed-in session outside React state so callbacks (the API
 * client's token lookup, refresh races) always read the latest value. Render
 * code uses the session from context instead; nothing reads this during
 * render.
 */
export function createSessionHolder() {
  let current: MobileSession | null = null;

  return {
    get: () => current,
    set: (next: MobileSession | null) => {
      current = next;
    }
  };
}
