/** Makes a phone photo smaller before upload (long side at most 1600 px, JPEG). Returns the original if it is already small
 *  or cannot be read. Runs only in the browser; nothing leaves the phone until the upload. */
export async function shrinkPhoto(file: File, maxSide = 1600, quality = 0.82): Promise<{ blob: Blob; type: string; name: string }> {
  const original = { blob: file as Blob, type: file.type, name: file.name };
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= 1.5 * 1024 * 1024) { bitmap.close?.(); return original; }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return original;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close?.();
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return original;
    return { blob, type: 'image/jpeg', name: file.name.replace(/\.[^.]+$/, '') + '.jpg' };
  } catch { return original; }
}
