"use client";

import { useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  function reset() {
    setParsed(null); setMapping({}); setFileError(null); setProgress(null); setResult(null);
  }

  function handleOpenChange(o: boolean) {
    if (progress !== null) return; // don't close mid-import
    if (!o) reset();
    onOpenChange(o);
  }

  async function onFile(file: File | undefined) {
    reset();
    if (!file) return;
    const rows = parseCsv(await file.text());
    if (rows.length < 2) {
      setFileError("This file has no data rows. Check that it's a CSV with column headers in the first row.");
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import your voter list</DialogTitle>
          <DialogDescription>
            Upload a CSV exported from your county or a spreadsheet. We&apos;ll match the columns; check them before importing.
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
            {result.error && (
              <p className="text-destructive">
                Import stopped at row {result.error.stoppedAtRow}: {result.error.message}. Rows before it were saved.
                Import the same file again to finish; rows already imported are skipped as duplicates.
              </p>
            )}
            {result.reasons.length > 0 && (
              <ul className="rounded-lg border divide-y text-sm">
                {result.reasons.slice(0, 5).map((s) => (
                  <li key={s.row} className="px-3 py-1.5 flex gap-3">
                    <span className="text-muted-foreground tabular-nums w-16 shrink-0">Row {s.row}</span>
                    <span>{s.reason}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor={`${id}-file`} className="text-xs">CSV file</Label>
              <Input
                id={`${id}-file`}
                type="file"
                accept=".csv,text/csv"
                className="mt-1"
                disabled={progress !== null}
                onChange={(e) => onFile(e.target.files?.[0])}
              />
              {fileError && <p className="text-sm text-destructive mt-1.5">{fileError}</p>}
            </div>

            {parsed && (
              <>
                <p className="text-sm text-muted-foreground">
                  {parsed.rows.length.toLocaleString()} {parsed.rows.length === 1 ? "row" : "rows"} found in {parsed.fileName}.
                </p>

                <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                  <legend className="text-sm font-medium mb-2">Columns</legend>
                  {IMPORT_FIELDS.map((f) => (
                    <div key={f.key} className="flex items-center gap-2">
                      <Label htmlFor={`${id}-${f.key}`} className="text-xs w-24 shrink-0">{f.label}</Label>
                      <Select
                        value={mapping[f.key] === undefined ? SKIP : String(mapping[f.key])}
                        onValueChange={(v) => setMapping({ ...mapping, [f.key]: v === SKIP ? undefined : Number(v) })}
                      >
                        <SelectTrigger id={`${id}-${f.key}`} className="h-8 flex-1 min-w-0"><SelectValue /></SelectTrigger>
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
                {!namesMapped && (
                  <p className="text-sm text-destructive">Choose the columns for first name and last name to continue.</p>
                )}

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
            <Button type="button" onClick={() => handleOpenChange(false)}>Done</Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={progress !== null}>Cancel</Button>
              <Button type="button" onClick={runImport} disabled={!parsed || !namesMapped || progress !== null}>
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
