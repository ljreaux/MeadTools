"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AccountPagination } from "@/components/account/pagination";
import { PagedResults } from "@/components/ui/paged-results";
import { cn } from "@/lib/utils";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from "@/components/ui/input-group";
import { Search, X } from "lucide-react";

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

import {
  useHydrometerInfo,
  type Device
} from "@/hooks/reactQuery/useHydrometerInfo";
import { useHydrometerBrews } from "@/hooks/reactQuery/useHydrometerBrews";
import Loading from "@/components/loading";
import { useFuzzySearch } from "@/hooks/useFuzzySearch";
import { ButtonGroup } from "@/components/ui/button-group";

type DeviceRow = Device & { name: string };

function Devices() {
  const { t } = useTranslation();
  const { data, isLoading, isError, error } = useHydrometerInfo();

  const [pageSize, setPageSize] = useState(5);
  const pageOptions = [5, 10, 20, 50].map((n) => ({
    value: n,
    label: `${n} items`
  }));

  const deviceList: Device[] = data?.devices ?? [];

  // Normalize for search/sort (so unnamed devices are searchable too)
  const rows: DeviceRow[] = useMemo(
    () =>
      deviceList.map((d) => ({
        ...d,
        name: d.device_name ?? t("unnamedDevice", "Unnamed device")
      })),
    [deviceList, t]
  );

  const searchKey = "name" as const;

  const {
    filteredData,
    pageData,
    searchValue,
    search,
    clearSearch,
    page,
    nextPage,
    prevPage,
    goToPage,
    totalPages
  } = useFuzzySearch({
    data: rows,
    pageSize,
    searchKey
  });

  if (isLoading) return <Loading />;

  if (isError) {
    console.error("Error loading devices:", error);
    return (
      <div className="my-6">
        <h2 className="text-2xl">{t("iSpindelDashboard.nav.device")}</h2>
        <p className="text-destructive mt-3">
          {t("error.generic", "Something went wrong loading devices.")}
        </p>
      </div>
    );
  }

  return (
    <div className="my-6">
      {/* Header */}

      <h2 className="text-2xl">{t("iSpindelDashboard.nav.device")}</h2>

      {rows.length === 0 ? (
        <div className="flex items-center justify-center my-10">
          <p>{t("noDevices")}</p>
        </div>
      ) : (
        <PagedResults
          scroll
          scrollClassName="sm:max-h-[60vh]"
          controls={
            <div className="grid gap-2 sm:gap-3 mt-4">
              <div className="flex items-center gap-2">
                {/* Search */}
                <div className="flex items-center gap-2 flex-1">
                  <label className="text-sm font-medium whitespace-nowrap">
                    {t("search", "Search")}:
                  </label>

                  <InputGroup className="w-full sm:max-w-sm">
                    <InputGroupInput
                      value={searchValue}
                      onChange={(e) => search(e.target.value)}
                      placeholder={t(
                        "iSpindelDashboard.devices.searchPlaceholder",
                        "Search devices"
                      )}
                    />
                    <InputGroupAddon>
                      <Search />
                    </InputGroupAddon>
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        title={t("clear", "Clear")}
                        onClick={clearSearch}
                        className={cn({ hidden: searchValue.length === 0 })}
                      >
                        <X />
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                </div>

                {/* Per page (desktop only) */}
                <div className="hidden sm:flex items-center gap-2">
                  <span className="text-sm font-medium whitespace-nowrap">
                    {t("pagination.perPage", "Per page:")}
                  </span>

                  <Select
                    value={String(pageSize)}
                    onValueChange={(val) => setPageSize(parseInt(val))}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {pageOptions.map((opt) => (
                        <SelectItem key={opt.value} value={String(opt.value)}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          }
          footer={
            filteredData.length > 0 ? (
              <div className="mt-4 flex flex-col gap-2">
                <AccountPagination
                  page={page}
                  totalPages={totalPages}
                  canPrev={page > 1}
                  canNext={page < totalPages}
                  onPrev={prevPage}
                  onNext={nextPage}
                  onGoTo={goToPage}
                />
              </div>
            ) : null
          }
        >
          <div className="flex flex-wrap justify-center gap-4 py-2">
            {pageData.length > 0 ? (
              pageData.map((dev) => <DeviceCard device={dev} key={dev.id} />)
            ) : (
              <p className="w-full text-center mt-6">
                {t(
                  "iSpindelDashboard.devices.noResults",
                  "No matching devices."
                )}
              </p>
            )}
          </div>
        </PagedResults>
      )}
    </div>
  );
}

export default Devices;

const DeviceCard = ({ device }: { device: Device }) => {
  const { t } = useTranslation();
  const [fileName, setFileName] = useState("");

  const { startBrew, endBrew, isStarting, isEnding } = useHydrometerBrews();
  const brewName = device.brews?.name ?? null;

  const handleStart = async () => {
    await startBrew(device.id, fileName || null);
    setFileName("");
  };

  const handleEnd = async () => {
    await endBrew(device.id, device.brew_id);
  };

  return (
    <div className="flex flex-col gap-2 border rounded-lg p-3 w-full sm:w-[20rem] lg:w-[18rem] xl:w-[20rem] sm:max-w-none">
      <h3 className="font-semibold text-center">
        {device.device_name ?? t("unnamedDevice", "Unnamed device")}
      </h3>

      <div className="grid gap-2">
        {/* Joined “view details + start/end” group */}
        <ButtonGroup className="w-full">
          <Button
            asChild
            variant="secondary"
            size="sm"
            className="flex-1 justify-center"
          >
            <Link href={`/account/hydrometer/devices/${device.id}`}>
              {t("iSpindelDashboard.deviceDetails")}
            </Link>
          </Button>

          {!device.brew_id ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1 justify-center"
                  disabled={isStarting}
                >
                  {isStarting
                    ? t("iSpindelDashboard.startBrew.loading", "Starting…")
                    : t("iSpindelDashboard.startBrew")}
                </Button>
              </AlertDialogTrigger>

              <AlertDialogContent className="z-[1000] w-11/12 max-w-md">
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t("iSpindelDashboard.addBrewName")}
                  </AlertDialogTitle>
                  <AlertDialogDescription className="flex flex-col gap-2">
                    <Input
                      value={fileName}
                      onChange={(e) => setFileName(e.target.value)}
                      placeholder={t(
                        "iSpindelDashboard.brewNamePlaceholder",
                        "Optional brew name"
                      )}
                    />
                  </AlertDialogDescription>
                </AlertDialogHeader>

                <AlertDialogFooter>
                  <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                  <AlertDialogAction asChild>
                    <Button
                      variant="secondary"
                      onClick={handleStart}
                      disabled={isStarting}
                    >
                      {isStarting
                        ? t("iSpindelDashboard.startBrew.loading", "Starting…")
                        : t("iSpindelDashboard.startBrew")}
                    </Button>
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button
              variant="destructive"
              size="sm"
              className="flex-1 justify-center border"
              onClick={handleEnd}
              disabled={isEnding}
            >
              {isEnding
                ? t("iSpindelDashboard.endBrew.loading", "Ending…")
                : t("iSpindelDashboard.endBrew", {
                    brew_name:
                      brewName ??
                      t("iSpindelDashboard.unknownBrew", "your brew")
                  })}
            </Button>
          )}
        </ButtonGroup>
      </div>
    </div>
  );
};
