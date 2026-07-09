type GoogleAuthClientIds = {
  androidClientId?: string;
  iosClientId?: string;
  webClientId?: string;
};

export const googleAuthClientIds: GoogleAuthClientIds = {
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
};

export function isGoogleAuthConfigured(
  platform = process.env.EXPO_OS,
  clientIds = googleAuthClientIds
) {
  switch (platform) {
    case "ios":
      return Boolean(clientIds.iosClientId && clientIds.webClientId);
    case "android":
      return Boolean(clientIds.androidClientId && clientIds.webClientId);
    case "web":
      return false;
    default:
      return false;
  }
}
