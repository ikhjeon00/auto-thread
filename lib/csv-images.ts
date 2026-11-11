/** CSV 의 사진 칸(images, reply_image)을 선택한 파일과 이름으로 짝짓기(순수 함수) */
export const CSV_MAX_IMAGES = 5;

/** 경로·대소문자·유니코드 조합 차이를 무시한 파일 이름 */
export function normalizeFileName(name: string): string {
  return name.trim().replace(/^.*[\\/]/, "").normalize("NFC").toLowerCase();
}

export function splitImages(cell: string | undefined): string[] {
  return (cell ?? "")
    .split(/[|;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export type RowImagePlan = {
  index: number;
  images: string[];
  replyImage: string | null;
  missing: string[];
  error: string | null;
};

export function planRowImages(rows: Record<string, string>[], fileNames: string[]): { rows: RowImagePlan[]; needed: string[]; missing: string[] } {
  const have = new Set(fileNames.map(normalizeFileName));
  const needed = new Set<string>();
  const missingAll = new Set<string>();
  const out = rows.map((r, index) => {
    const images = splitImages(r.images);
    const replyImage = splitImages(r.reply_image)[0] ?? null;
    const refs = [...images, ...(replyImage ? [replyImage] : [])];
    const missing = refs.filter((n) => !have.has(normalizeFileName(n)));
    refs.forEach((n) => (have.has(normalizeFileName(n)) ? needed.add(normalizeFileName(n)) : missingAll.add(n)));
    let error: string | null = null;
    if (images.length > CSV_MAX_IMAGES) error = `본문 사진이 ${images.length}장입니다(최대 ${CSV_MAX_IMAGES}장).`;
    else if (splitImages(r.reply_image).length > 1) error = "첫 댓글 사진은 1장만 넣을 수 있습니다.";
    else if (missing.length) error = `없는 파일: ${missing.join(", ")}`;
    return { index, images, replyImage, missing, error };
  });
  return { rows: out, needed: [...needed], missing: [...missingAll] };
}

export const CSV_EXAMPLE = [
  "text,first_reply,topic_tag,category,images,reply_image",
  '"요즘 잘 쓰는 살림템 3가지\n1. 건조대\n2. 주걱\n3. 청소기",다들 뭐 쓰세요?,살림템,살림,item_1.jpg|item_2.jpg|item_3.jpg,item_reply.jpg',
  "비 오는 날엔 괜히 따뜻한 국물이 당긴다,,음식,음식,,",
].join("\r\n");
