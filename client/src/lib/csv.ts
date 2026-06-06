export function exportCSV<T extends Record<string, unknown>>(
  filename: string,
  rows: T[],
  columns?: { key: keyof T & string; label?: string }[]
): void {
  if (rows.length === 0) return;

  const activeCols = columns || Object.keys(rows[0]).map((key) => ({ key, label: key }));
  const headerRow = activeCols.map((c) => JSON.stringify(c.label || c.key)).join(",");

  const dataRows = rows.map((row) =>
    activeCols
      .map((c) => {
        const val = row[c.key];
        if (val === null || val === undefined) return '""';
        return JSON.stringify(String(val));
      })
      .join(",")
  );

  const csvContent = [headerRow, ...dataRows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
