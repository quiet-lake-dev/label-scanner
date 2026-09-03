"use client";

import { useEffect, useMemo } from "react";
import { ResultPanel } from "@/components/ResultPanel";
import type { VerificationResult } from "@/lib/types";

interface Props {
  file?: File;
  result: VerificationResult;
}

/** The full result for one batch row, with the picture beside it. */
export function RowDetails({ file, result }: Props) {
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_1fr]">
      {preview ? (
        // Local object URL; nothing for next/image to optimise.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="max-h-96 w-full rounded border border-stone-200 bg-white object-contain" />
      ) : (
        <div />
      )}
      <ResultPanel result={result} />
    </div>
  );
}
