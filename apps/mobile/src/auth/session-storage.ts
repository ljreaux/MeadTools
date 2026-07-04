import * as SecureStore from "expo-secure-store";

const SESSION_KEY = "meadtools.mobile.session.v1";

export type MobileSession = {
  accessToken: string;
  email: string;
  id: number;
  refreshToken: string;
  role: string | null;
};

function isMobileSession(value: unknown): value is MobileSession {
  if (!value || typeof value !== "object") {
    return false;
  }

  const session = value as Record<string, unknown>;
  return (
    typeof session.accessToken === "string" &&
    typeof session.email === "string" &&
    typeof session.id === "number" &&
    typeof session.refreshToken === "string" &&
    (typeof session.role === "string" || session.role === null)
  );
}

export async function loadSession() {
  const storedSession = await SecureStore.getItemAsync(SESSION_KEY);

  if (!storedSession) {
    return null;
  }

  try {
    const session: unknown = JSON.parse(storedSession);
    return isMobileSession(session) ? session : null;
  } catch {
    return null;
  }
}

export async function saveSession(session: MobileSession) {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
