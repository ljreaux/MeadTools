import { useLocalSearchParams } from "expo-router";

import { HydrometerDeviceScreen } from "@/hydrometers/device-screen";

export default function DeviceScreen() {
  const { deviceId } = useLocalSearchParams<{ deviceId: string }>();
  return <HydrometerDeviceScreen deviceId={deviceId ?? ""} />;
}
