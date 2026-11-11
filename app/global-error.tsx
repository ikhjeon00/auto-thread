"use client";

/** 최상위 레이아웃까지 실패했을 때(글꼴·스타일 없이도 읽히게 단순하게) */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="ko">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 40, textAlign: "center", background: "#F7F5F0" }}>
        <h1 style={{ fontSize: 20 }}>앱을 불러오지 못했습니다</h1>
        <p style={{ color: "#78726a" }}>잠시 뒤 다시 시도하세요.</p>
        <button onClick={reset} style={{ marginTop: 12, padding: "8px 16px", background: "#E8590C", color: "#fff", border: 0, borderRadius: 8 }}>
          다시 시도
        </button>
      </body>
    </html>
  );
}
