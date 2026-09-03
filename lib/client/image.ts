/**
 * Shrinks a photo in the browser before upload. Phone photos are often 4000px
 * and several megabytes. 1200px on the long edge keeps the warning text
 * readable and cuts about half a second off the model's time compared with
 * sending the full size.
 */
const MAX_EDGE = 1200;
const SKIP_UNDER_BYTES = 800 * 1024;

export async function prepareImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // format the browser cannot decode; let the server try
  }
  const longest = Math.max(bitmap.width, bitmap.height);
  if (longest <= MAX_EDGE && file.size <= SKIP_UNDER_BYTES) {
    bitmap.close();
    return file;
  }
  const scale = Math.min(1, MAX_EDGE / longest);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.88),
  );
  if (!blob) return file;
  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}
