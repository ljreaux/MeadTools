import type { ConfigContext, ExpoConfig } from "expo/config";

import appJson from "./app.json";

function getGoogleIosUrlScheme() {
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

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
          iosUrlScheme: getGoogleIosUrlScheme()
        }
      ]
    ] as ExpoConfig["plugins"]
  };
}
