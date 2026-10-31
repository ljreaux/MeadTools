import Header from "@/components/account/header";
import { EquipmentWorkspace } from "@/components/account/EquipmentWorkspace";

export default function EquipmentPage() {
  return <div className="relative w-11/12 max-w-[1200px] rounded-xl bg-background px-4 py-6 sm:px-12 sm:py-8">
    <Header />
    <EquipmentWorkspace />
  </div>;
}
