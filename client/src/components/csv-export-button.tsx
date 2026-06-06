import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportCSV } from "@/lib/csv";
import { notify } from "@/lib/notify";

export function CsvExportButton<T extends Record<string, unknown>>({
  filename,
  rows,
  columns,
  disabled,
  label = "Export CSV",
}: {
  filename: string;
  rows: T[];
  columns?: { key: keyof T & string; label?: string }[];
  disabled?: boolean;
  label?: string;
}) {
  const empty = rows.length === 0;
  function onClick() {
    if (empty) {
      notify.info("Nothing to export");
      return;
    }
    exportCSV(filename, rows, columns);
    notify.success(`Exported ${rows.length} row${rows.length === 1 ? "" : "s"}`);
  }
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled || empty}
    >
      <Download className="mr-1.5 h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
