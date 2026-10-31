import SupportDialog from "./SupportDialog";
import TutorialDialog from "./TutorialDialog";
import TaplistReleaseBanner from "./TaplistDialog";
import BrewTrackerDialog from "./BrewTrackerDialog";
import RaptCloudUpdateBanner from "./RaptCloudUpdateBanner";
import PremiumLaunchBanner from "@/components/account/PremiumLaunchBanner";

function Dialogs() {
  return (
    <>
      <SupportDialog />
      <TaplistReleaseBanner />
      <TutorialDialog />
      <BrewTrackerDialog />
      <RaptCloudUpdateBanner />
      <PremiumLaunchBanner />
    </>
  );
}

export default Dialogs;
