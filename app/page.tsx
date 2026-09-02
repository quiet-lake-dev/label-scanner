"use client";

import { useState } from "react";
import { ApplicationForm } from "@/components/ApplicationForm";
import { ImagePicker } from "@/components/ImagePicker";
import { ResultPanel } from "@/components/ResultPanel";
import { useElapsed } from "@/components/useElapsed";
import { verifyLabel } from "@/lib/client/api";
import { SAMPLES, type Sample } from "@/lib/samples";
import type { Application, VerificationResult } from "@/lib/types";

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

  const canSubmit = !!image && app.brandName.trim() !== "" && !busy;

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

  async function loadSample(s: Sample) {
    setError(null);
    setResult(null);
    const res = await fetch(s.image);
    const blob = await res.blob();
    setImage(new File([blob], s.image.split("/").pop() ?? "sample.png", { type: blob.type }));
    setApp(s.application);
  }

  return (
    <div className="space-y-6">
      <p className="text-lg text-stone-700">
        Add the label picture, type in what the application says, and press <strong>Check label</strong>.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-xl font-semibold">1. Label picture</h2>
          <ImagePicker file={image} onChange={setImage} disabled={busy} />
          <div className="mt-3 text-base text-stone-600">
            <span className="mr-2">Or try a sample:</span>
            {SAMPLES.map((s) => (
              <button
                key={s.id}
                type="button"
                className="mr-2 mb-1 rounded border border-stone-300 bg-white px-2 py-1 hover:bg-stone-100"
                disabled={busy}
                onClick={() => loadSample(s)}
                title={`Expected: ${s.expect}`}
              >
                {s.title}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold">2. Application details</h2>
          <ApplicationForm value={app} onChange={setApp} disabled={busy} />
        </section>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button type="button" className="btn btn-primary min-w-56 text-xl" disabled={!canSubmit} onClick={check}>
          {busy ? `Reading label… ${elapsed.toFixed(1)} s` : "Check label"}
        </button>
        {!image && !busy ? <span className="text-stone-600">Add a picture to start.</span> : null}
        {image && !app.brandName.trim() && !busy ? (
          <span className="text-stone-600">Enter at least the brand name.</span>
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
