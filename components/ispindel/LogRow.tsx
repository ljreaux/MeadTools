"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import { de, enUS } from "date-fns/locale";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/hooks/use-toast";
import { useISpindel } from "../providers/ISpindelProvider";

const LogRow = ({ log, remove }: { log: any; remove: () => void }) => {
  const { i18n } = useTranslation();
  const defaultLocale = i18n.resolvedLanguage?.includes("de") ? de : enUS;
  const [editable, setEditable] = useState(false);
  const [currentLog, setCurrentLog] = useState({
    ...log,
    calculated_gravity: log.calculated_gravity ?? "",
  });

  const { deleteLog, updateLog } = useISpindel();

  const handleDelete = async () => {
    try {
      await deleteLog(log.id, log.device_id);
      remove();
      toast({ description: "Log deleted successfully" });
    } catch (error) {
      console.error("Error deleting log:", error);
      toast({ description: "Error deleting log", variant: "destructive" });
    }
  };

  const handleUpdate = async () => {
    try {
      const updatedLog = await updateLog(currentLog);
      if (!updatedLog) throw new Error("Failed to update log");

      toast({ description: "Log updated successfully" });
      setCurrentLog(updatedLog);
    } catch (error) {
      console.error("Error updating log:", error);
      toast({ description: "Error updating log", variant: "destructive" });
    } finally {
      setEditable(false);
    }
  };

  return (
    <TableRow>
      <TableCell className="w-24">
        <DateTimePicker
          value={new Date(currentLog.datetime)}
          disabled={!editable}
          onChange={(val) =>
            setCurrentLog({ ...currentLog, datetime: val?.toISOString() })
          }
          locale={defaultLocale}
          displayFormat={{ hour24: "Pp" }}
        />
      </TableCell>
      <TableCell>
        <Input
          value={currentLog.gravity}
          disabled={!editable}
          onChange={(e) =>
            setCurrentLog({ ...currentLog, gravity: e.target.value })
          }
          className="w-[4.5rem]"
        />
      </TableCell>
      <TableCell>
        <Input
          value={currentLog.calculated_gravity}
          disabled={!editable}
          onChange={(e) =>
            setCurrentLog({ ...currentLog, calculated_gravity: e.target.value })
          }
        />
      </TableCell>
      <TableCell>
        <span className="flex items-center  w-full gap-1">
          <Input
            value={currentLog.temperature}
            disabled={!editable}
            onChange={(e) =>
              setCurrentLog({ ...currentLog, temperature: e.target.value })
            }
            className="w-[4.5rem]"
          />
          <p> °{currentLog.temp_units}</p>
        </span>
      </TableCell>
      <TableCell className="grid grid-flow-col gap-2 px-4">
        {editable ? (
          <>
            <Button onClick={handleUpdate}>Update</Button>
            <Button
              onClick={() => {
                setEditable(false);
                setCurrentLog(log);
              }}
              variant={"destructive"}
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => setEditable(true)}>Edit</Button>
            <DeleteButton handleClick={handleDelete} />
          </>
        )}
      </TableCell>
    </TableRow>
  );
};

const DeleteButton = ({ handleClick }: { handleClick: () => void }) => {
  const { t } = useTranslation();
  return (
    <AlertDialog>
      <AlertDialogTrigger
        className={buttonVariants({ variant: "destructive" })}
      >
        {t("desktop.delete")}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("desktop.confirm")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("iSpindelDashboard.deleteLog")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            onClick={handleClick}
          >
            {t("desktop.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default LogRow;
