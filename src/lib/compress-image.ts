const TARGET_BYTES = 4 * 1024 * 1024;
const MAX_EDGE = 2400;

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('사진 파일을 읽을 수 없습니다.')); };
    image.src = url;
  });
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('사진을 압축하지 못했습니다.')), 'image/jpeg', quality));
}

export async function compressPhotoInFormData(formData: FormData, field = 'photo') {
  const value = formData.get(field);
  if (!(value instanceof File) || value.size === 0 || value.size <= TARGET_BYTES) return formData;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(value.type)) throw new Error('사진은 JPG, PNG, WEBP 형식만 사용할 수 있습니다.');

  const image = await loadImage(value);
  let scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  let compressed: Blob | null = null;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('이 브라우저에서는 사진을 압축할 수 없습니다.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    compressed = await canvasBlob(canvas, Math.max(.48, .88 - attempt * .05));
    if (compressed.size <= TARGET_BYTES) break;
    scale *= Math.min(.82, Math.sqrt(TARGET_BYTES / compressed.size) * .92);
  }
  if (!compressed || compressed.size > TARGET_BYTES) throw new Error('사진 용량을 줄이지 못했습니다. 다른 사진을 선택해 주세요.');
  const baseName = value.name.replace(/\.[^.]+$/, '') || 'face-photo';
  formData.set(field, new File([compressed], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() }));
  return formData;
}
