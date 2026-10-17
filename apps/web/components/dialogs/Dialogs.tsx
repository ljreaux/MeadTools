import SupportDialog from "./SupportDialog";
import TutorialDialog from "./TutorialDialog";
import TaplistReleaseBanner from "./TaplistDialog";
import BrewTrackerDialog from "./BrewTrackerDialog";
import RaptCloudUpdateBanner from "./RaptCloudUpdateBanner";

function Dialogs() {
  return (
    <>
      <SupportDialog />
      <TaplistReleaseBanner />
      <TutorialDialog />
      <BrewTrackerDialog />
      <RaptCloudUpdateBanner />
    </>
  );
}

export default Dialogs;
