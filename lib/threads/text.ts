/**
 * Threads 글자 수 규칙: 일반 문자는 1자, 이모지는 UTF-8 바이트 수로 센다.
 * (https://developers.facebook.com/docs/threads/posts — "Emojis are counted as the number of UTF-8 bytes")
 */
export const THREADS_TEXT_LIMIT = 500;

const segmenter = new Intl.Segmenter("ko", { granularity: "grapheme" });
const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣/u;
const encoder = new TextEncoder();

export function countThreadsChars(text: string): number {
  let n = 0;
  for (const { segment } of segmenter.segment(text)) {
    n += EMOJI.test(segment) ? encoder.encode(segment).length : 1;
  }
  return n;
}
