import { useLocalSearchParams } from "expo-router";
import { HydrometerReadingsScreen } from "@/hydrometers/readings-screen";
export default function DeviceReadings() {
  const { deviceId } = useLocalSearchParams<{ deviceId: string }>();
  return <HydrometerReadingsScreen deviceId={deviceId} />;
}
