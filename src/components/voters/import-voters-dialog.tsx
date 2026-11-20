"use client";

import { useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { autoMapColumns, buildImportRows, IMPORT_FIELDS, parseCsv, type ColumnMapping } from "@/lib/csv";

const CHUNK_SIZE = 1000;
const SKIP = "skip";

interface Parsed {
  fileName: string;
  headers: string[];
  rows: string[][];
}

interface Result {
  created: number;
  skippedCount: number;
  reasons: { row: number; reason: string }[];
  /** Set when a chunk failed; rows before `stoppedAtRow` were saved. */
  error?: { message: string; stoppedAtRow: number };
}

// Spreadsheet row number of a data row: header is row 1.
const sheetRow = (dataIndex: number) => dataIndex + 2;

export function ImportVotersDialog({ open, onOpenChange, campaignId }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  campaignId: string | null;
}) {
  const id = useId();
  const qc = useQueryClient();
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [fileError, setFileError] = useState<string | null>(null);
  const [excelFile, setExcelFile] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [showAllFields, setShowAllFields] = useState(false);

  function reset() {
    setParsed(null); setMapping({}); setFileError(null); setExcelFile(null); setProgress(null); setResult(null); setShowAllFields(false);
  }

  function handleOpenChange(o: boolean) {
    if (progress !== null) return; // don't close mid-import
    if (!o) reset();
    onOpenChange(o);
  }

  async function onFile(file: File | undefined) {
    reset();
    if (!file) return;
    if (/\.xls[xmb]?$/i.test(file.name)) {
      setExcelFile(file.name);
      return;
    }
    const rows = parseCsv(await file.text());
    if (rows.length < 2) {
      setFileError("This file has no data rows. Check that it's a CSV or tab-separated file with column headers in the first row.");
      return;
    }
    const [headers, ...data] = rows;
    setParsed({ fileName: file.name, headers, rows: data });
    setMapping(autoMapColumns(headers));
  }

  async function runImport() {
    if (!parsed) return;
    const all = buildImportRows(parsed.rows, mapping);
    const total: Result = { created: 0, skippedCount: 0, reasons: [] };
    for (let start = 0; start < all.length; start += CHUNK_SIZE) {
      setProgress(start);
      const r = await fetch("/api/voters/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, rows: all.slice(start, start + CHUNK_SIZE) }),
      }).catch(() => null);
      if (!r?.ok) {
        const body = await r?.json().catch(() => null);
        total.error = {
          message: body?.error ?? "The server couldn't be reached",
          stoppedAtRow: sheetRow(start),
        };
        break;
      }
      const body: { created: number; skippedCount: number; skipped: { row: number; reason: string }[] } = await r.json();
      total.created += body.created;
      total.skippedCount += body.skippedCount;
      // Server rows are 1-based within the chunk.
      total.reasons.push(...body.skipped.map((s) => ({ row: sheetRow(start + s.row - 1), reason: s.reason })));
    }
    setProgress(null);
    setResult(total);
    qc.invalidateQueries({ queryKey: ["voters", campaignId] });
    qc.invalidateQueries({ queryKey: ["precincts", campaignId] });
    qc.invalidateQueries({ queryKey: ["dashboard", campaignId] });
  }

  const namesMapped = mapping.firstName !== undefined && mapping.lastName !== undefined;
  const mappedFields = IMPORT_FIELDS.filter((f) => mapping[f.key] !== undefined);
  // Name fields and matched columns show first; the rest wait behind "Map more columns".
  const visibleFields = showAllFields
    ? IMPORT_FIELDS
    : IMPORT_FIELDS.filter((f) => f.key === "firstName" || f.key === "lastName" || mapping[f.key] !== undefined);
  const hiddenFieldCount = IMPORT_FIELDS.length - visibleFields.length;
  const usedColumns = new Set(Object.values(mapping));
  const ignoredColumns = parsed ? parsed.headers.map((h, i) => h || `Column ${i + 1}`).filter((_, i) => !usedColumns.has(i)) : [];
  const noPrecinctWarning = mapping.precinct === undefined && (
    <p className="font-medium">
      No precinct column is matched, so every voter from this file goes into the &ldquo;No precinct&rdquo; walk list.
    </p>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import your voter list</DialogTitle>
          <DialogDescription>
            Upload the voter file from your county election office, or any spreadsheet saved as CSV. We&apos;ll match the columns; check them before importing.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3 text-sm" role="status">
            <p>
              Imported <span className="font-semibold tabular-nums">{result.created.toLocaleString()}</span>{" "}
              {result.created === 1 ? "voter" : "voters"}.
              {result.skippedCount > 0 && (
                <> Skipped <span className="font-semibold tabular-nums">{result.skippedCount.toLocaleString()}</span> {result.skippedCount === 1 ? "row" : "rows"}.</>
              )}
            </p>
            {result.created > 0 && noPrecinctWarning}
            {result.error && (
              <p className="text-destructive">
                Import stopped at row {result.error.stoppedAtRow}: {result.error.message}. Rows before it were saved.
                Import the same file again to finish; rows already imported are skipped as duplicates.
              </p>
            )}
            {result.reasons.length > 0 && (
              <>
                <ul className="max-h-48 overflow-y-auto rounded-lg border divide-y text-sm">
                  {result.reasons.map((s) => (
                    <li key={s.row} className="px-3 py-1.5 flex gap-3">
                      <span className="text-muted-foreground tabular-nums w-16 shrink-0">Row {s.row}</span>
                      <span>{s.reason}</span>
                    </li>
                  ))}
                </ul>
                {result.skippedCount > result.reasons.length && (
                  <p className="text-xs text-muted-foreground">
                    {(result.skippedCount - result.reasons.length).toLocaleString()} more skipped rows aren&apos;t listed.
                  </p>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium">CSV file</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-3">
                <input
                  id={`${id}-file`}
                  type="file"
                  accept=".csv,.tsv,.txt,.xlsx,.xls,text/csv,text/tab-separated-values"
                  className="peer sr-only"
                  disabled={progress !== null}
                  onChange={(e) => onFile(e.target.files?.[0])}
                />
                <Label
                  htmlFor={`${id}-file`}
                  className="inline-flex h-11 sm:h-9 cursor-pointer items-center gap-2 rounded-md border bg-background px-4 text-sm font-medium shadow-xs hover:bg-accent peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50 peer-disabled:pointer-events-none peer-disabled:opacity-50"
                >
                  <Upload className="size-4" aria-hidden />
                  {parsed ? "Choose a different file" : "Choose CSV file"}
                </Label>
                <span className="text-sm text-muted-foreground truncate">{parsed?.fileName ?? excelFile ?? "No file chosen"}</span>
              </div>
              {fileError && <p className="text-sm text-destructive mt-1.5">{fileError}</p>}
              {excelFile && (
                <div className="mt-3 rounded-lg border bg-muted/30 p-3 text-sm space-y-1.5" role="status">
                  <p className="font-medium">This is an Excel file. Save it as a CSV first, then choose the CSV here.</p>
                  <ol className="list-decimal pl-5 space-y-0.5 text-muted-foreground">
                    <li>Open the file in Excel.</li>
                    <li>Choose File, then Save As.</li>
                    <li>Pick the format &ldquo;CSV UTF-8 (Comma delimited) (.csv)&rdquo; and save.</li>
                  </ol>
                  <p className="text-muted-foreground">
                    Using Google Sheets? Choose File, then Download, then &ldquo;Comma Separated Values (.csv)&rdquo;.
                  </p>
                </div>
              )}
            </div>

            {parsed && (
              <>
                <p className="text-sm text-muted-foreground">
                  {parsed.rows.length.toLocaleString()} {parsed.rows.length === 1 ? "row" : "rows"} found.
                </p>

                <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 sm:gap-y-2">
                  <legend className="text-sm font-medium mb-2">Match your columns</legend>
                  {visibleFields.map((f) => (
                    <div key={f.key} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                      <Label htmlFor={`${id}-${f.key}`} className="text-xs sm:w-24 sm:shrink-0">{f.label}</Label>
                      <Select
                        value={mapping[f.key] === undefined ? SKIP : String(mapping[f.key])}
                        onValueChange={(v) => setMapping({ ...mapping, [f.key]: v === SKIP ? undefined : Number(v) })}
                      >
                        <SelectTrigger id={`${id}-${f.key}`} className="w-full min-w-0 data-[size=default]:h-11 sm:flex-1 sm:data-[size=default]:h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SKIP}>Don&apos;t import</SelectItem>
                          {parsed.headers.map((h, i) => (
                            <SelectItem key={i} value={String(i)}>{h || `Column ${i + 1}`}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </fieldset>
                {hiddenFieldCount > 0 && (
                  <Button type="button" variant="outline" size="sm" className="h-11 sm:h-8" onClick={() => setShowAllFields(true)}>
                    Map more columns ({hiddenFieldCount})
                  </Button>
                )}
                {!namesMapped && (
                  <p className="text-sm text-destructive">Choose the columns for first name and last name to continue.</p>
                )}

                <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1.5">
                  {noPrecinctWarning}
                  {ignoredColumns.length > 0 && (
                    <p>
                      <span className="font-medium">Not imported:</span>{" "}
                      <span className="text-muted-foreground">{ignoredColumns.join(", ")}</span>
                    </p>
                  )}
                  <p className="text-muted-foreground">
                    Rows that match a voter already on your list are skipped: by county voter ID when both have one,
                    otherwise by name and street address. Precinct names you don&apos;t have yet are added to your precincts.
                  </p>
                </div>

                {mappedFields.length > 0 && (
                  <div>
                    <div className="text-sm font-medium mb-2">Preview</div>
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b bg-muted/30 text-muted-foreground">
                            {mappedFields.map((f) => <th key={f.key} className="text-left font-medium px-2 py-1.5 whitespace-nowrap">{f.label}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {parsed.rows.slice(0, 5).map((cells, r) => (
                            <tr key={r} className="border-b last:border-b-0">
                              {mappedFields.map((f) => (
                                <td key={f.key} className="px-2 py-1.5 whitespace-nowrap">{cells[mapping[f.key]!] ?? ""}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button type="button" className="h-11 sm:h-9" onClick={() => handleOpenChange(false)}>Done</Button>
          ) : (
            <>
              <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={() => handleOpenChange(false)} disabled={progress !== null}>Cancel</Button>
              <Button type="button" className="h-11 sm:h-9" onClick={runImport} disabled={!parsed || !namesMapped || progress !== null}>
                {progress !== null ? <Loader2 className="size-4 animate-spin mr-1" /> : <Upload className="size-4 mr-1" />}
                {progress !== null && parsed
                  ? `Importing ${progress.toLocaleString()} of ${parsed.rows.length.toLocaleString()}…`
                  : parsed ? `Import ${parsed.rows.length.toLocaleString()} ${parsed.rows.length === 1 ? "row" : "rows"}` : "Import"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
