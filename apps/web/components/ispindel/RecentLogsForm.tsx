import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { DatePickerWithRange } from "@/components/ui/daterange-picker";
import { useTranslation } from "react-i18next";

const FormSchema = z
  .object({
    dateRange: z.object(
      {
        from: z.date(),
        to: z.date()
      },
      {
        required_error: "Please select a date range"
      }
    )
  })
  .refine((data) => data.dateRange.from <= data.dateRange.to, {
    path: ["dateRange"],
    message: "From date must be before to date"
  });

const DEFAULT_VALUE = {
  dateRange: {
    from: new Date(Date.now() - 86400000),
    to: new Date()
  }
};

type RecentLogsFormProps = {
  deviceId: string; // still passed for future use if needed
  onRangeChange: (args: { startISO: string; endISO: string }) => void;
};

const RecentLogsForm = ({ onRangeChange }: RecentLogsFormProps) => {
  const form = useForm<z.infer<typeof FormSchema>>({
    defaultValues: DEFAULT_VALUE,
    resolver: zodResolver(FormSchema)
  });

  const { t } = useTranslation();

  async function onSubmit({
    dateRange: { from, to }
  }: z.infer<typeof FormSchema>) {
    const startISO = new Date(from.setUTCHours(0, 0, 0, 0)).toISOString();
    const endISO = new Date(to.setUTCHours(23, 59, 59, 999)).toISOString();

    // Let the parent update dateRange state and refetch via useDeviceLogs
    onRangeChange({ startISO, endISO });
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex items-end gap-3 flex-wrap"
      >
        <FormField
          control={form.control}
          name="dateRange"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="datetime">
                {t("iSpindelDashboard.brews.dateRange")}
              </FormLabel>
              <FormControl>
                <DatePickerWithRange
                  date={field.value}
                  setDate={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
};

export default RecentLogsForm;
