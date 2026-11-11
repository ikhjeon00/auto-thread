/**
 * 브라우저에서 업로드 전 미디어 정리 (작업지시서 8장 "미디어 업로드")
 * - 이미지: HEIC/WebP 등은 JPEG로 변환, 가로 1440px 이하로 줄이고 8MB 이하로 맞춘다.
 * - 영상: 형식·길이·용량만 검사하고 규격을 벗어나면 경고한다(변환 없음).
 */
export const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const IMAGE_MAX_WIDTH = 1440;
export const VIDEO_MAX_BYTES = 1024 * 1024 * 1024;
export const VIDEO_MAX_SECONDS = 300;
const SUPABASE_FREE_LIMIT = 50 * 1024 * 1024;

export type Prepared = {
  blob: Blob;
  name: string;
  contentType: "image/jpeg" | "image/png" | "video/mp4" | "video/quicktime";
  mediaType: "image" | "video";
  width?: number;
  height?: number;
  warnings: string[];
};

export class PrepareError extends Error {}

const isHeic = (f: File) => /image\/hei[cf]/i.test(f.type) || /\.(heic|heif)$/i.test(f.name);
const isVideo = (f: File) => f.type.startsWith("video/") || /\.(mp4|mov)$/i.test(f.name);

export async function prepareFile(file: File): Promise<Prepared> {
  return isVideo(file) ? prepareVideo(file) : prepareImage(file);
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new PrepareError("이미지 변환에 실패했습니다."))), "image/jpeg", quality),
  );
}

export async function prepareImage(file: File): Promise<Prepared> {
  let source: Blob = file;
  const heic = isHeic(file);
  if (heic) {
    const heic2any = (await import("heic2any")).default;
    const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
    source = Array.isArray(out) ? out[0] : out;
  } else if (!file.type.startsWith("image/")) {
    throw new PrepareError(`${file.name}: 이미지나 영상 파일이 아닙니다.`);
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
  } catch {
    throw new PrepareError(`${file.name}: 이미지를 읽을 수 없습니다.`);
  }
  const { width, height } = bitmap;
  const keepOriginal =
    !heic && (file.type === "image/jpeg" || file.type === "image/png") && width <= IMAGE_MAX_WIDTH && file.size <= IMAGE_MAX_BYTES;
  if (keepOriginal) {
    bitmap.close();
    return { blob: file, name: file.name, contentType: file.type as "image/jpeg" | "image/png", mediaType: "image", width, height, warnings: [] };
  }

  const scale = Math.min(1, IMAGE_MAX_WIDTH / width);
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; // 투명 PNG → JPEG 변환 시 검은 배경 방지
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  let blob: Blob | null = null;
  for (const q of [0.9, 0.82, 0.74, 0.65, 0.55, 0.45]) {
    blob = await canvasToBlob(canvas, q);
    if (blob.size <= IMAGE_MAX_BYTES) break;
  }
  if (!blob || blob.size > IMAGE_MAX_BYTES) throw new PrepareError(`${file.name}: 8MB 이하로 줄이지 못했습니다.`);
  return {
    blob,
    name: file.name.replace(/\.[^.]+$/, "") + ".jpg",
    contentType: "image/jpeg",
    mediaType: "image",
    width: w,
    height: h,
    warnings: [],
  };
}

function videoMeta(file: File): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    const done = (r: { duration: number; width: number; height: number }) => {
      URL.revokeObjectURL(url);
      resolve(r);
    };
    v.onloadedmetadata = () => done({ duration: v.duration, width: v.videoWidth, height: v.videoHeight });
    v.onerror = () => done({ duration: NaN, width: 0, height: 0 });
    v.src = url;
  });
}

export async function prepareVideo(file: File): Promise<Prepared> {
  const isMov = file.type === "video/quicktime" || /\.mov$/i.test(file.name);
  const isMp4 = file.type === "video/mp4" || /\.mp4$/i.test(file.name);
  if (!isMov && !isMp4) throw new PrepareError(`${file.name}: 영상은 MP4 또는 MOV만 올릴 수 있습니다.`);
  if (file.size > VIDEO_MAX_BYTES) throw new PrepareError(`${file.name}: 영상은 1GB 이하여야 합니다.`);

  const warnings: string[] = [];
  const meta = await videoMeta(file);
  if (Number.isFinite(meta.duration) && meta.duration > VIDEO_MAX_SECONDS) {
    warnings.push(`길이가 ${Math.round(meta.duration)}초로 Threads 제한(5분)을 넘어 발행이 실패할 수 있습니다.`);
  }
  if (meta.width > 1920) warnings.push(`가로 ${meta.width}px로 Threads 권장(1920px 이하)을 넘습니다.`);
  if (file.size > SUPABASE_FREE_LIMIT) {
    warnings.push("50MB가 넘습니다. Supabase Free 플랜에서는 업로드가 거부될 수 있습니다.");
  }
  return {
    blob: file,
    name: file.name,
    contentType: isMov ? "video/quicktime" : "video/mp4",
    mediaType: "video",
    width: meta.width || undefined,
    height: meta.height || undefined,
    warnings,
  };
}
