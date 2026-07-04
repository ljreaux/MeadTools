import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  type ComponentType,
  createContext,
  type PropsWithChildren,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";

import {
  MeadToolsApiError,
  type MeadToolsApiClient
} from "@meadtools/api-client";

import { createMobileApiClient } from "@/api/client";
import {
  clearSession as clearStoredSession,
  loadSession,
  type MobileSession,
  saveSession
} from "@/auth/session-storage";
import { isAccessTokenExpired } from "@/auth/token";

type SessionContextValue = {
  session: MobileSession | null;
  status: "authenticated" | "loading" | "unauthenticated";
  signIn(input: { email: string; password: string }): Promise<void>;
  signInWithGoogle(idToken: string): Promise<void>;
  signOut(): Promise<void>;
};

const ApiClientContext = createContext<MeadToolsApiClient | null>(null);
const SessionContext = createContext<SessionContextValue | null>(null);

// The web workspace retains React 18 type packages while Expo uses React 19.
// Keep that type-only monorepo boundary isolated at the shared provider.
const MobileQueryClientProvider = QueryClientProvider as unknown as ComponentType<{
  children: ReactNode;
  client: QueryClient;
}>;

function SessionProvider({
  children,
  queryClient
}: PropsWithChildren<{ queryClient: QueryClient }>) {
  const sessionRef = useRef<MobileSession | null>(null);
  const [session, setSession] = useState<MobileSession | null>(null);
  const [status, setStatus] =
    useState<SessionContextValue["status"]>("loading");
  const [apiClient] = useState(() =>
    createMobileApiClient(() => sessionRef.current?.accessToken)
  );

  const updateSession = useCallback((nextSession: MobileSession | null) => {
    sessionRef.current = nextSession;
    setSession(nextSession);
    setStatus(nextSession ? "authenticated" : "unauthenticated");
  }, []);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      let storedSession: MobileSession | null;

      try {
        storedSession = await loadSession();
      } catch {
        if (active) {
          updateSession(null);
        }
        return;
      }

      if (!active) {
        return;
      }

      if (!storedSession) {
        updateSession(null);
        return;
      }

      if (!isAccessTokenExpired(storedSession.accessToken)) {
        updateSession(storedSession);
        return;
      }

      try {
        const refreshed = await apiClient.refreshAccessToken({
          email: storedSession.email,
          refreshToken: storedSession.refreshToken
        });
        const nextSession = {
          ...storedSession,
          accessToken: refreshed.accessToken
        };

        await saveSession(nextSession);
        if (active) {
          updateSession(nextSession);
        }
      } catch (error) {
        if (error instanceof MeadToolsApiError) {
          await clearStoredSession();
        }
        if (active) {
          updateSession(null);
        }
      }
    }

    void restoreSession();

    return () => {
      active = false;
    };
  }, [apiClient, updateSession]);

  const signIn = useCallback(
    async (input: { email: string; password: string }) => {
      const response = await apiClient.login(input);
      const nextSession: MobileSession = {
        accessToken: response.accessToken,
        email: response.email,
        id: response.id,
        refreshToken: response.refreshToken,
        role: response.role
      };

      await saveSession(nextSession);
      updateSession(nextSession);
    },
    [apiClient, updateSession]
  );

  const signOut = useCallback(async () => {
    await clearStoredSession();
    queryClient.clear();
    updateSession(null);
  }, [queryClient, updateSession]);

  const signInWithGoogle = useCallback(
    async (idToken: string) => {
      const response = await apiClient.signInWithGoogle(idToken);
      const nextSession: MobileSession = {
        accessToken: response.accessToken,
        email: response.user.email,
        id: response.user.id,
        refreshToken: response.refreshToken,
        role: response.user.role
      };

      await saveSession(nextSession);
      updateSession(nextSession);
    },
    [apiClient, updateSession]
  );

  return (
    <SessionContext
      value={{
        session,
        status,
        signIn,
        signInWithGoogle,
        signOut
      }}
    >
      <ApiClientContext value={apiClient}>{children}</ApiClientContext>
    </SessionContext>
  );
}

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 30_000
          },
          mutations: {
            retry: false
          }
        }
      })
  );

  return (
    <MobileQueryClientProvider client={queryClient}>
      <SessionProvider queryClient={queryClient}>{children}</SessionProvider>
    </MobileQueryClientProvider>
  );
}

export function useApiClient() {
  const apiClient = use(ApiClientContext);

  if (!apiClient) {
    throw new Error("useApiClient must be used within AppProviders");
  }

  return apiClient;
}

export function useSession() {
  const session = use(SessionContext);

  if (!session) {
    throw new Error("useSession must be used within AppProviders");
  }

  return session;
}
