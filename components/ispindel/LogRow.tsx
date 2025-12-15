"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { de, enUS } from "date-fns/locale";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";

import { toast } from "@/hooks/use-toast";
import {
  useUpdateLog,
  useDeleteLog,
  type Log
} from "@/hooks/reactQuery/useHydrometerLogs";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput
} from "../ui/input-group";

const LogRow = ({ log, remove }: { log: Log; remove: () => void }) => {
  const { t, i18n } = useTranslation();
  const defaultLocale = i18n.resolvedLanguage?.includes("de") ? de : enUS;

  const [editable, setEditable] = useState(false);
  const [currentLog, setCurrentLog] = useState<
    Omit<Log, "gravity" | "temperature" | "calculated_gravity"> & {
      gravity: string | number;
      temperature: string | number;
      calculated_gravity: string | number | null;
    }
  >({
    ...log,
    gravity: log.gravity,
    temperature: log.temperature,
    calculated_gravity: log.calculated_gravity ?? ""
  });

  const { mutateAsync: updateLogMutate, isPending: isUpdating } =
    useUpdateLog();
  const { mutateAsync: deleteLogMutate, isPending: isDeleting } =
    useDeleteLog();

  const handleDelete = async () => {
    try {
      await deleteLogMutate({ logId: log.id, deviceId: log.device_id });
      remove();
      toast({ description: t("log.deleted", "Log deleted successfully") });
    } catch (error) {
      console.error("Error deleting log:", error);
      toast({
        description: t("error.generic", "Error deleting log"),
        variant: "destructive"
      });
    }
  };

  const handleUpdate = async () => {
    try {
      const sanitized: Log = {
        ...log,
        ...currentLog,
        gravity: Number(currentLog.gravity),
        temperature: Number(currentLog.temperature),
        calculated_gravity:
          currentLog.calculated_gravity === "" ||
          currentLog.calculated_gravity === null
            ? null
            : Number(currentLog.calculated_gravity)
      };

      const updatedLog = await updateLogMutate(sanitized);

      toast({ description: t("log.updated", "Log updated successfully") });

      setCurrentLog({
        ...updatedLog,
        gravity: updatedLog.gravity,
        temperature: updatedLog.temperature,
        calculated_gravity: updatedLog.calculated_gravity ?? ""
      });
    } catch (error) {
      console.error("Error updating log:", error);
      toast({
        description: t("error.generic", "Error updating log"),
        variant: "destructive"
      });
    } finally {
      setEditable(false);
    }
  };

  const resetEdits = () => {
    setEditable(false);
    setCurrentLog({
      ...log,
      gravity: log.gravity,
      temperature: log.temperature,
      calculated_gravity: log.calculated_gravity ?? ""
    });
  };

  return (
    <TableRow>
      <TableCell>
        <DateTimePicker
          value={new Date(currentLog.datetime)}
          disabled={!editable}
          onChange={(val) =>
            setCurrentLog({
              ...currentLog,
              datetime: val?.toISOString() ?? currentLog.datetime
            })
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
        />
      </TableCell>

      <TableCell>
        <Input
          value={currentLog.calculated_gravity ?? ""}
          disabled={!editable}
          onChange={(e) =>
            setCurrentLog({
              ...currentLog,
              calculated_gravity: e.target.value
            })
          }
        />
      </TableCell>

      <TableCell>
        <InputGroup>
          <InputGroupInput
            value={currentLog.temperature}
            disabled={!editable}
            onChange={(e) =>
              setCurrentLog({ ...currentLog, temperature: e.target.value })
            }
            className="w-[5.5rem]"
          />
          <InputGroupAddon align="inline-end">
            °{currentLog.temp_units}
          </InputGroupAddon>
        </InputGroup>
      </TableCell>

      <TableCell className="min-w-48">
        <ButtonGroup className="w-full">
          {editable ? (
            <ButtonGroup>
              <Button onClick={handleUpdate} disabled={isUpdating}>
                {isUpdating
                  ? t("updating", "Updating…")
                  : t("update", "Update")}
              </Button>

              <Button variant="secondary" onClick={resetEdits}>
                {t("cancel", "Cancel")}
              </Button>
            </ButtonGroup>
          ) : (
            <ButtonGroup>
              <Button onClick={() => setEditable(true)}>
                {t("edit", "Edit")}
              </Button>

              <DeleteButton handleClick={handleDelete} disabled={isDeleting} />
            </ButtonGroup>
          )}
        </ButtonGroup>
      </TableCell>
    </TableRow>
  );
};

const DeleteButton = ({
  handleClick,
  disabled
}: {
  handleClick: () => void;
  disabled?: boolean;
}) => {
  const { t } = useTranslation();

  return (
    <AlertDialog>
      {/* IMPORTANT: asChild so the trigger is a real <Button /> and groups correctly */}
      <AlertDialogTrigger asChild>
        <Button variant="destructive" disabled={disabled}>
          {t("desktop.delete")}
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent className="z-[1000] w-11/12 max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("desktop.confirm")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("iSpindelDashboard.deleteLog")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleClick}
              disabled={disabled}
            >
              {t("desktop.delete")}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default LogRow;
