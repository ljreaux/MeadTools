import type { ConfigContext, ExpoConfig } from "expo/config";

import appJson from "./app.json";

type GoogleIosSchemeOptions = {
  clientId?: string;
  buildProfile?: string;
};

export function getGoogleIosUrlScheme({
  clientId,
  buildProfile
}: GoogleIosSchemeOptions) {
  if (!clientId && buildProfile === "preview") {
    // Preview can use password sign-in until Google OAuth is configured in EAS.
    return "com.googleusercontent.apps.000000000000-ci";
  }

  if (!clientId?.endsWith(".apps.googleusercontent.com")) {
    throw new Error(
      "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID must be set to the iOS OAuth client ID"
    );
  }

  return `com.googleusercontent.apps.${clientId.slice(
    0,
    -".apps.googleusercontent.com".length
  )}`;
}

export default function mobileAppConfig({
  config
}: ConfigContext): ExpoConfig {
  const staticConfig = appJson.expo as ExpoConfig;
  const plugins = staticConfig.plugins ?? [];

  return {
    ...config,
    ...staticConfig,
    plugins: [
      ...plugins,
      [
        "react-native-nitro-google-signin",
        {
          iosUrlScheme: getGoogleIosUrlScheme({
            clientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
            buildProfile: process.env.EAS_BUILD_PROFILE
          })
        }
      ]
    ] as ExpoConfig["plugins"]
  };
}
