"use client";

import { useMemo, useRef, useState } from "react";
import { StatusBadge } from "@/components/ResultPanel";
import { RowDetails } from "@/components/RowDetails";
import { useElapsed } from "@/components/useElapsed";
import { verifyLabel } from "@/lib/client/api";
import { parseCsvRecords, toCsv } from "@/lib/csv";
import { SAMPLES } from "@/lib/samples";
import type { Application, BeverageType, VerificationResult } from "@/lib/types";
import { FIELD_LABELS, VERDICT_LABELS } from "@/lib/types";

const CONCURRENCY = 4;
const TEST_KIT_URL = "/test-kit/label-check-test-kit.zip";

const TEMPLATE_COLUMNS = [
  "filename",
  "beverage_type",
  "brand_name",
  "class_type",
  "alcohol_content",
  "net_contents",
  "bottler_name_address",
  "country_of_origin",
];

interface Row {
  filename: string;
  application: Application;
  file?: File;
  state: "waiting" | "running" | "done" | "failed";
  result?: VerificationResult;
  error?: string;
}

function toBeverageType(s: string): BeverageType {
  const n = s.toLowerCase();
  if (n.includes("wine")) return "wine";
  if (n.includes("malt") || n.includes("beer")) return "malt_beverage";
  return "distilled_spirits";
}

function rowsFromCsv(text: string): Omit<Row, "state">[] {
  return parseCsvRecords(text)
    .filter((r) => r.filename || r.file_name || r.image)
    .map((r) => ({
      filename: r.filename || r.file_name || r.image,
      application: {
        beverageType: toBeverageType(r.beverage_type ?? ""),
        brandName: r.brand_name ?? r.brand ?? "",
        classType: r.class_type ?? r.class ?? "",
        alcoholContent: r.alcohol_content ?? r.abv ?? "",
        netContents: r.net_contents ?? "",
        bottlerNameAddress: r.bottler_name_address ?? r.bottler ?? "",
        countryOfOrigin: r.country_of_origin ?? r.country ?? "",
      },
    }));
}

export default function BatchPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [files, setFiles] = useState<Map<string, File>>(new Map());
  const [busy, setBusy] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const elapsed = useElapsed(busy);
  const abortRef = useRef<AbortController | null>(null);

  const matched = useMemo(
    () => rows.map((r) => ({ ...r, file: files.get(r.filename.toLowerCase()) })),
    [rows, files],
  );
  const withImage = matched.filter((r) => r.file).length;
  const done = matched.filter((r) => r.state === "done" || r.state === "failed").length;

  async function onCsv(list: FileList | null) {
    const f = list?.[0];
    if (!f) return;
    setCsvError(null);
    try {
      const parsed = rowsFromCsv(await f.text());
      if (parsed.length === 0) {
        setCsvError("No rows found. The CSV needs a 'filename' column plus the application fields.");
      }
      setRows(parsed.map((r) => ({ ...r, state: "waiting" })));
      setOpen(new Set());
    } catch {
      setCsvError("Could not read that file as CSV.");
    }
  }

  function onImages(list: FileList | null) {
    if (!list) return;
    const next = new Map(files);
    for (const f of Array.from(list)) next.set(f.name.toLowerCase(), f);
    setFiles(next);
  }

  async function loadSampleBatch() {
    const next = new Map<string, File>();
    for (const s of SAMPLES) {
      const blob = await (await fetch(s.image)).blob();
      const name = s.image.split("/").pop()!;
      next.set(name.toLowerCase(), new File([blob], name, { type: blob.type }));
    }
    setFiles(next);
    setRows(
      SAMPLES.map((s) => ({
        filename: s.image.split("/").pop()!,
        application: s.application,
        state: "waiting",
      })),
    );
    setCsvError(null);
    setOpen(new Set());
  }

  function toggle(i: number) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  async function runAll() {
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    const queue = matched
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.file && r.state !== "done");
    setRows((prev) => prev.map((r, i) => (queue.some((q) => q.i === i) ? { ...r, state: "running", error: undefined } : r)));

    const update = (i: number, patch: Partial<Row>) =>
      setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

    const worker = async () => {
      while (queue.length && !controller.signal.aborted) {
        const { r, i } = queue.shift()!;
        try {
          const result = await verifyLabel(r.file!, r.application, controller.signal);
          update(i, { state: "done", result });
        } catch (err) {
          if (controller.signal.aborted) {
            update(i, { state: "waiting" });
          } else {
            update(i, { state: "failed", error: err instanceof Error ? err.message : "Failed" });
          }
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    setBusy(false);
  }

  function downloadResults() {
    const header = [
      "filename",
      "brand_name",
      "verdict",
      "reasons",
      ...Object.values(FIELD_LABELS),
      "government_warning",
      "seconds",
    ];
    const body = matched.map((r) => {
      const res = r.result;
      const fieldCol = (key: keyof typeof FIELD_LABELS) => {
        const f = res?.fields.find((x) => x.field === key);
        return f ? `${f.status}: ${f.note}` : "";
      };
      return [
        r.filename,
        r.application.brandName,
        res ? VERDICT_LABELS[res.verdict] : r.error ? `Error: ${r.error}` : r.file ? "" : "No image",
        res?.reasons.join(" | ") ?? "",
        ...(Object.keys(FIELD_LABELS) as (keyof typeof FIELD_LABELS)[]).map(fieldCol),
        res ? `${res.warning.status}: ${res.warning.note}` : "",
        res ? (res.totalMs / 1000).toFixed(1) : "",
      ];
    });
    save("label-check-results.csv", toCsv([header, ...body]));
  }

  return (
    <div className="space-y-6">
      <p className="text-lg text-stone-700">
        Upload a spreadsheet of applications (CSV) and the label pictures. Each row is matched to a picture by its{" "}
        <strong>filename</strong> column.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-stone-200 bg-white p-4">
          <h2 className="mb-2 text-xl font-semibold">1. Application spreadsheet</h2>
          <input type="file" accept=".csv,text/csv" className="block text-lg" disabled={busy} onChange={(e) => onCsv(e.target.files)} />
          <p className="mt-2 text-base text-stone-600">
            Columns: {TEMPLATE_COLUMNS.join(", ")}.{" "}
            <button type="button" className="underline" onClick={() => save("label-check-template.csv", toCsv([TEMPLATE_COLUMNS]))}>
              Download a blank template
            </button>
          </p>
          {csvError ? <p className="mt-2 text-red-700">{csvError}</p> : null}
          {rows.length ? (
            <p className="mt-2">{rows.length} applications loaded.</p>
          ) : (
            <p className="mt-2 text-base text-stone-600">
              Nothing to hand? <a href={TEST_KIT_URL} download className="underline">Download the test kit</a> (2 MB): six label
              pictures and a filled-in spreadsheet. Unzip it, then upload the spreadsheet here and the pictures on the right.
            </p>
          )}
        </section>

        <section className="rounded-lg border border-stone-200 bg-white p-4">
          <h2 className="mb-2 text-xl font-semibold">2. Label pictures</h2>
          <input type="file" accept="image/*" multiple className="block text-lg" disabled={busy} onChange={(e) => onImages(e.target.files)} />
          <p className="mt-2 text-base text-stone-600">You can select many files at once.</p>
          {rows.length ? (
            <p className="mt-2">
              {withImage} of {rows.length} applications have a matching picture.
            </p>
          ) : null}
        </section>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button type="button" className="btn btn-primary min-w-56 text-xl" disabled={busy || withImage === 0} onClick={runAll}>
          {busy ? `Checking… ${done} of ${withImage} (${elapsed.toFixed(0)} s)` : `Check ${withImage || ""} labels`}
        </button>
        {busy ? (
          <button type="button" className="btn btn-secondary" onClick={() => abortRef.current?.abort()}>
            Stop
          </button>
        ) : null}
        {done > 0 && !busy ? (
          <button type="button" className="btn btn-secondary" onClick={downloadResults}>
            Download results (CSV)
          </button>
        ) : null}
        {rows.length === 0 ? (
          <button type="button" className="text-stone-600 underline" onClick={loadSampleBatch}>
            Load the sample labels
          </button>
        ) : null}
      </div>

      {matched.length ? (
        <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
          <table className="w-full text-left">
            <thead className="bg-stone-100 text-base text-stone-600">
              <tr>
                <th className="px-3 py-2">File</th>
                <th className="px-3 py-2">Brand</th>
                <th className="px-3 py-2">Verdict</th>
                <th className="px-3 py-2">Summary</th>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">
                  <span className="sr-only">Details</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {matched.map((r, i) => {
                const expanded = open.has(i);
                const canOpen = Boolean(r.result);
                return [
                  <tr
                    key={`row-${i}`}
                    className={`border-t border-stone-200 align-top ${canOpen ? "cursor-pointer hover:bg-stone-50" : ""}`}
                    onClick={() => canOpen && toggle(i)}
                  >
                    <td className="px-3 py-2 font-mono text-sm">{r.filename}</td>
                    <td className="px-3 py-2">{r.application.brandName}</td>
                    <td className="px-3 py-2">
                      <RowVerdict row={r} />
                    </td>
                    <td className="px-3 py-2 text-base text-stone-700">
                      {r.result ? (
                        <div className="space-y-1">
                          <div className="flex flex-wrap gap-1">
                            {r.result.fields.map((f) => (
                              <span key={f.field} title={f.note} className="inline-flex items-center gap-1 text-sm">
                                {f.label}: <StatusBadge status={f.status} />
                              </span>
                            ))}
                          </div>
                          <ul className="list-disc pl-5">
                            {r.result.reasons.map((x) => (
                              <li key={x}>{x}</li>
                            ))}
                          </ul>
                        </div>
                      ) : r.error ? (
                        <span className="text-red-700">{r.error}</span>
                      ) : !r.file ? (
                        <span className="text-stone-500">No picture with this filename was uploaded.</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.result ? `${(r.result.totalMs / 1000).toFixed(1)} s` : ""}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {canOpen ? (
                        <button
                          type="button"
                          className="btn btn-secondary px-3 py-1 text-base"
                          aria-expanded={expanded}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggle(i);
                          }}
                        >
                          {expanded ? "Hide" : "Details"}
                        </button>
                      ) : null}
                    </td>
                  </tr>,
                  expanded && r.result ? (
                    <tr key={`details-${i}`} className="border-t border-stone-200 bg-stone-50">
                      <td colSpan={6} className="p-4">
                        <RowDetails file={r.file} result={r.result} />
                      </td>
                    </tr>
                  ) : null,
                ];
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function RowVerdict({ row }: { row: Row }) {
  if (row.result) {
    const v = row.result.verdict;
    const style =
      v === "likely_approve"
        ? "bg-green-100 text-green-900"
        : v === "needs_review"
          ? "bg-amber-100 text-amber-900"
          : v === "likely_reject"
            ? "bg-red-100 text-red-900"
            : "bg-stone-200 text-stone-800";
    return <span className={`inline-block rounded px-2 py-0.5 font-medium ${style}`}>{VERDICT_LABELS[v]}</span>;
  }
  if (row.state === "running") return <span className="text-stone-600">Checking…</span>;
  if (row.state === "failed") return <span className="text-red-700">Error</span>;
  return <span className="text-stone-400">Waiting</span>;
}

function save(name: string, content: string) {
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
