"use client";

import { useState } from "react";
import { ApplicationForm } from "@/components/ApplicationForm";
import { ImagePicker } from "@/components/ImagePicker";
import { ResultPanel } from "@/components/ResultPanel";
import { useElapsed } from "@/components/useElapsed";
import { verifyLabel } from "@/lib/client/api";
import { SAMPLE_GROUPS, SAMPLES } from "@/lib/samples";
import type { Application, VerificationResult } from "@/lib/types";
import { FIELD_NAMES } from "@/lib/types";

const EMPTY: Application = {
  beverageType: "distilled_spirits",
  brandName: "",
  classType: "",
  alcoholContent: "",
  netContents: "",
  bottlerNameAddress: "",
  countryOfOrigin: "",
};

export default function Home() {
  const [image, setImage] = useState<File | null>(null);
  const [app, setApp] = useState<Application>(EMPTY);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const elapsed = useElapsed(busy);

  const nothingEntered = FIELD_NAMES.every((f) => !app[f]?.trim());

  async function check() {
    if (!image) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await verifyLabel(image, app));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function loadSample(id: string) {
    const s = SAMPLES.find((x) => x.id === id);
    if (!s) return;
    setError(null);
    setResult(null);
    const blob = await (await fetch(s.image)).blob();
    setImage(new File([blob], s.image.split("/").pop() ?? "sample", { type: blob.type }));
    setApp(s.application);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-xl font-semibold">Label picture</h2>
          <ImagePicker file={image} onChange={setImage} disabled={busy} />
          <label className="mt-3 block text-stone-600">
            Or try a sample:
            <select className="field mt-1" value="" disabled={busy} onChange={(e) => loadSample(e.target.value)}>
              <option value="">Choose a sample label</option>
              {SAMPLE_GROUPS.map((g) => (
                <optgroup key={g.kind} label={g.title}>
                  {SAMPLES.filter((s) => s.kind === g.kind).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold">What the application says</h2>
          <ApplicationForm value={app} onChange={setApp} disabled={busy} />
        </section>
      </div>

      <div className="space-y-2">
        <button type="button" className="btn btn-primary w-full text-2xl lg:w-auto lg:min-w-80" disabled={!image || busy} onClick={check}>
          {busy ? `Reading label… ${elapsed.toFixed(1)} s` : "Check label"}
        </button>
        {!image && !busy ? <p className="text-stone-600">Add a picture to start.</p> : null}
        {image && nothingEntered && !busy ? (
          <p className="text-stone-600">No application details entered, so only the government warning will be checked.</p>
        ) : null}
      </div>

      {error ? (
        <div role="alert" className="rounded-lg border-2 border-red-600 bg-red-50 p-4 text-lg text-red-900">
          {error}
        </div>
      ) : null}

      {result ? <ResultPanel result={result} /> : null}
    </div>
  );
}
