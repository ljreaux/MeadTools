import SupportDialog from "./SupportDialog";
import TutorialDialog from "./TutorialDialog";
import TaplistReleaseBanner from "./TaplistDialog";
import BrewTrackerDialog from "./BrewTrackerDialog";

function Dialogs() {
  return (
    <>
      <SupportDialog />
      <TaplistReleaseBanner />
      <TutorialDialog />
      <BrewTrackerDialog />
    </>
  );
}

export default Dialogs;
