import { useLocalSearchParams } from "expo-router";
import { HydrometerBrewsScreen } from "@/hydrometers/brews-screen";
export default function HydrometerBrew() {
  const { brewId } = useLocalSearchParams<{ brewId: string }>();
  return <HydrometerBrewsScreen key={brewId} brewId={brewId ?? ""} />;
}
