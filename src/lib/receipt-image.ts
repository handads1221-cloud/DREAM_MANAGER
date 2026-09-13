type ReceiptImageOptions = {
  bottomRatio?: number;
  maxDimension?: number;
};

export async function preprocessReceiptImage(file: File, options: ReceiptImageOptions = {}): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const bottomRatio = Math.min(1, Math.max(0.35, options.bottomRatio ?? 1));
    const sourceHeight = Math.round(bitmap.height * bottomRatio);
    const sourceTop = bitmap.height - sourceHeight;
    const maxDimension = options.maxDimension ?? 1450;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, sourceHeight));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return file;
    context.drawImage(bitmap, 0, sourceTop, bitmap.width, sourceHeight, 0, 0, width, height);
    bitmap.close();
    const image = context.getImageData(0, 0, width, height);
    for (let index = 0; index < image.data.length; index += 4) {
      const gray = image.data[index] * .299 + image.data[index + 1] * .587 + image.data[index + 2] * .114;
      const contrasted = Math.max(0, Math.min(255, (gray - 128) * 1.42 + 145));
      image.data[index] = contrasted;
      image.data[index + 1] = contrasted;
      image.data[index + 2] = contrasted;
    }
    context.putImageData(image, 0, 0);
    return await new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob ?? file), 'image/jpeg', .9));
  } catch {
    return file;
  }
}
