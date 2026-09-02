"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface Props {
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}

export function ImagePicker({ file, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const pick = (list: FileList | null) => {
    const f = list?.[0];
    if (f) onChange(f);
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Choose a label image"
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) pick(e.dataTransfer.files);
        }}
        className={`flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 text-center transition ${
          dragging ? "border-blue-500 bg-blue-50" : "border-stone-300 bg-white hover:bg-stone-50"
        }`}
      >
        {preview ? (
          // Plain img: this is a local object URL, not something to optimise.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Selected label" className="max-h-96 rounded object-contain" />
        ) : (
          <>
            <p className="text-xl font-medium">Drop the label picture here</p>
            <p className="mt-2 text-stone-600">or</p>
            <span className="btn btn-secondary mt-3">Choose a file</span>
            <p className="mt-4 text-sm text-stone-500">JPEG, PNG, or WebP</p>
          </>
        )}
      </div>
      {file ? (
        <div className="mt-2 flex items-center justify-between text-stone-600">
          <span className="truncate">{file.name}</span>
          <button
            type="button"
            className="ml-3 shrink-0 underline"
            disabled={disabled}
            onClick={() => {
              onChange(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
          >
            Change picture
          </button>
        </div>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => pick(e.target.files)}
      />
    </div>
  );
}
