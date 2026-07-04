import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  type ComponentType,
  createContext,
  type PropsWithChildren,
  type ReactNode,
  useState
} from "react";
import { use } from "react";

import type { MeadToolsApiClient } from "@meadtools/api-client";

import { createMobileApiClient } from "@/api/client";

const ApiClientContext = createContext<MeadToolsApiClient | null>(null);
// The web workspace retains React 18 type packages while Expo uses React 19.
// Keep that type-only monorepo boundary isolated at the shared provider.
const MobileQueryClientProvider = QueryClientProvider as unknown as ComponentType<{
  children: ReactNode;
  client: QueryClient;
}>;

export function AppProviders({ children }: PropsWithChildren) {
  const [apiClient] = useState(createMobileApiClient);
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
    <ApiClientContext value={apiClient}>
      <MobileQueryClientProvider client={queryClient}>
        {children}
      </MobileQueryClientProvider>
    </ApiClientContext>
  );
}

export function useApiClient() {
  const apiClient = use(ApiClientContext);

  if (!apiClient) {
    throw new Error("useApiClient must be used within AppProviders");
  }

  return apiClient;
}
