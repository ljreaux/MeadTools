"use client";

import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import Tooltip from "@/components/Tooltips";
import { Switch } from "@/components/ui/switch";
import {
  useBrews,
  useUpdateEmailAlerts,
  Brew
} from "@/hooks/reactQuery/useBrews";

function Brews() {
  const { t } = useTranslation();
  const { data: brews = [], isLoading, isError } = useBrews();

  const [currentPage, setCurrentPage] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  if (isLoading) {
    return <div className="text-center my-4">{t("loading", "Loading…")}</div>;
  }

  if (isError) {
    return (
      <div className="text-center my-4">
        {t("error.generic", "Something went wrong loading brews.")}
      </div>
    );
  }

  if (!brews || brews.length === 0) {
    return <p className="text-center my-4">{t("iSpindelDashboard.noBrews")}</p>;
  }

  const totalItems = brews.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const currentItems = brews.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(0);
  };

  return (
    <>
      <h2 className="my-4 text-2xl">{t("iSpindelDashboard.brews.label")}</h2>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("iSpindelDashboard.nameOrId")}</TableHead>
            <TableHead>{t("iSpindelDashboard.brews.startDate")}</TableHead>
            <TableHead>{t("iSpindelDashboard.brews.endDate")}</TableHead>
            <TableHead>{t("iSpindelDashboard.brews.latestGrav")}</TableHead>
            <TableHead>{t("iSpindelDashboard.brews.recipeLink")}</TableHead>
            <TableHead>
              {t("iSpindelDashboard.receiveEmailAlerts")}
              <Tooltip body={t("tipText.emailAlerts")} />
            </TableHead>
          </TableRow>
          <TableRow>
            <TableCell colSpan={5}>
              <label htmlFor="itemCount" className="flex flex-col gap-4">
                {t("iSpindelDashboard.pagination")}
                <Select
                  value={itemsPerPage.toString()}
                  onValueChange={(val) =>
                    handleItemsPerPageChange(parseInt(val, 10))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[5, 10, 20].map((value) => (
                      <SelectItem key={value} value={value.toString()}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </TableCell>
          </TableRow>
        </TableHeader>

        <TableBody>
          <BrewRow currentItems={currentItems} />
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 0}
            className={buttonVariants({ variant: "secondary" })}
          >
            {t("buttonLabels.back")}
          </button>
          <div className="mx-2 flex gap-2">
            {Array.from({ length: totalPages }, (_, index) => (
              <button
                key={index}
                onClick={() => handlePageChange(index)}
                className={buttonVariants({
                  variant: index === currentPage ? "default" : "secondary"
                })}
              >
                {index + 1}
              </button>
            ))}
          </div>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages - 1}
            className={buttonVariants({ variant: "secondary" })}
          >
            {t("buttonLabels.next")}
          </button>
        </div>
      )}
    </>
  );
}

export default Brews;

const BrewRow = ({ currentItems }: { currentItems: Brew[] }) => {
  const { i18n, t } = useTranslation();
  const formatter = new Intl.DateTimeFormat(i18n.resolvedLanguage, {
    dateStyle: "short",
    timeStyle: "short"
  });

  const formatDate = (date: string | Date) => formatter.format(new Date(date));

  const { mutateAsync: updateEmailAlerts } = useUpdateEmailAlerts();

  return (
    <>
      {currentItems.map((brew) => (
        <TableRow key={brew.id}>
          <TableCell className="truncate max-w-24 text-[rgb(200_215_255)]">
            <a href={`/account/hydrometer/logs/${brew.id}`}>
              {brew.name || brew.id}
            </a>
          </TableCell>
          <TableCell>{formatDate(brew.start_date)}</TableCell>
          <TableCell>
            {brew.end_date ? formatDate(brew.end_date) : "Ongoing"}
          </TableCell>
          <TableCell>{brew.latest_gravity?.toFixed(3) || "NA"}</TableCell>
          <TableCell>
            {brew.recipe_id ? (
              <a
                href={`/recipes/${brew.recipe_id}`}
                className={buttonVariants({ variant: "default" })}
              >
                {t("iSpindelDashboard.brews.open")}
              </a>
            ) : (
              <a
                href={`/account/hydrometer/link/${brew.id}`}
                className={buttonVariants({ variant: "default" })}
              >
                {t("iSpindelDashboard.brews.link")}
              </a>
            )}
          </TableCell>
          <TableCell>
            <DynamicCheckbox
              initialChecked={brew.requested_email_alerts}
              updateFn={(id, val) =>
                updateEmailAlerts({ brewId: id, requested: val })
              }
              brew_id={brew.id}
            />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
};

const DynamicCheckbox = ({
  initialChecked,
  updateFn,
  brew_id
}: {
  initialChecked: boolean;
  updateFn: (id: string, val: boolean) => Promise<unknown>;
  brew_id: string;
}) => {
  const [checked, setChecked] = useState(initialChecked);

  return (
    <div className="w-full flex items-center justify-center">
      <Switch
        checked={checked}
        onCheckedChange={async (val: boolean) => {
          try {
            setChecked(val);
            await updateFn(brew_id, val);

            const msg = val
              ? "You will receive email alerts for this brew."
              : "You will no longer receive email alerts for this brew.";

            toast({ description: msg });
          } catch {
            toast({
              description: "Something went wrong",
              variant: "destructive"
            });
            setChecked(!val);
          }
        }}
      />
    </div>
  );
};
