import { useState } from "react";
import { isValidNumber, parseNumber } from "@/lib/utils/validateInput";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel
} from "../ui/alert-dialog";
import { useTranslation } from "react-i18next";
import Tooltip from "../Tooltips";
import { ChevronDown } from "lucide-react";
import { Recipe } from "@/types/recipeDataTypes";

function MockBatchDetails({ useRecipe }: { useRecipe: () => Recipe }) {
  const { t } = useTranslation();
  const { setIngredientsToTarget } = useRecipe();
  const [{ og, volume }, setOgAndVolume] = useState({
    og: "",
    volume: ""
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleSubmit = () => {
    setIngredientsToTarget(parseNumber(og), parseNumber(volume));
    setIsDialogOpen(false);
    setOgAndVolume({ og: "", volume: "" });
  };

  return (
    <div className="border-b border-muted-foreground py-6">
      {/* Collapsible Header */}
      <div
        className="flex items-center justify-between cursor-pointer w-max"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <h3 className="flex items-center">
          {t("initialDetails.title")}
          <Tooltip body={t("tipText.desiredDetailsForm")} />
        </h3>
        <ChevronDown
          className={`w-5 h-5 transform transition-transform ${
            isCollapsed ? "" : "rotate-180"
          }`}
        />
      </div>

      {/* Collapsible Content */}
      {!isCollapsed && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setIsDialogOpen(true);
          }}
          className="joyride-initialDetails grid gap-1 mt-4"
        >
          <label className="mb-4">
            <Input
              value={og}
              placeholder="Enter OG"
              onChange={(e) => {
                if (isValidNumber(e.target.value))
                  setOgAndVolume({ volume, og: e.target.value });
              }}
            />
          </label>
          <label className="mb-4">
            <Input
              value={volume}
              placeholder="Enter Volume"
              onChange={(e) => {
                if (isValidNumber(e.target.value))
                  setOgAndVolume({ og, volume: e.target.value });
              }}
            />
          </label>
          <Button type="submit" className="max-w-24">
            {t("SUBMIT")}
          </Button>
        </form>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("desktop.confirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("calculateDetailsDialog")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsDialogOpen(false)}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button onClick={handleSubmit}>{t("SUBMIT")}</Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default MockBatchDetails;
