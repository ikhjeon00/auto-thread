"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Download, FileSpreadsheet, ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseCsv } from "@/lib/csv";
import { CSV_EXAMPLE, CSV_MAX_IMAGES, normalizeFileName, planRowImages } from "@/lib/csv-images";
import type { MediaItem } from "@/lib/compose/schema";
import { prepareFile } from "@/lib/media/prepare";
import { uploadPrepared } from "@/lib/media/upload";
import { importRowsAction } from "@/app/(main)/pools/actions";

const code = (t: string) => <code className="rounded bg-muted px-1">{t}</code>;

/** CSV 가져오기: 사진 칸(images, reply_image)에 적은 파일 이름을 함께 고른 사진 파일과 짝지어 올린다 */
export function CsvImport({ poolId }: { poolId: string }) {
  const router = useRouter();
  const [csvName, setCsvName] = useState("");
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [approve, setApprove] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const plan = useMemo(() => (rows ? planRowImages(rows, files.map((f) => f.name)) : null), [rows, files]);
  const okRows = plan ? plan.rows.filter((r) => !r.error) : [];
  const badRows = plan ? plan.rows.filter((r) => r.error) : [];

  const downloadExample = () => {
    const blob = new Blob(["﻿" + CSV_EXAMPLE], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "창고_가져오기_예시.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  async function runImport() {
    if (!rows || !plan) return;
    setMsg(null);
    // 1) 필요한 사진만 한 번씩 변환·업로드 (같은 사진을 여러 줄에서 써도 한 번)
    const byName = new Map(files.map((f) => [normalizeFileName(f.name), f]));
    const uploaded = new Map<string, MediaItem>();
    const failed = new Map<string, string>();
    const needed = plan.needed;
    for (let i = 0; i < needed.length; i++) {
      setBusy(`사진 올리는 중 ${i + 1}/${needed.length}`);
      const f = byName.get(needed[i])!;
      try {
        const [item] = await uploadPrepared([await prepareFile(f)], "assets");
        uploaded.set(needed[i], item);
      } catch (e) {
        failed.set(needed[i], e instanceof Error ? e.message : "업로드 실패");
      }
    }

    // 2) 사진 업로드에 실패한 줄은 빼고 가져온다
    const payload: Record<string, unknown>[] = [];
    let skippedByUpload = 0;
    for (const p of okRows) {
      const r = rows[p.index];
      const refs = [...p.images, ...(p.replyImage ? [p.replyImage] : [])].map(normalizeFileName);
      if (refs.some((n) => failed.has(n))) {
        skippedByUpload++;
        continue;
      }
      payload.push({
        text: r.text ?? "",
        first_reply: r.first_reply ?? "",
        topic_tag: r.topic_tag ?? "",
        category: r.category ?? "",
        media: p.images.map((n) => uploaded.get(normalizeFileName(n))!),
        reply_media: p.replyImage ? uploaded.get(normalizeFileName(p.replyImage))! : null,
      });
    }

    let added = 0;
    let skipped = 0;
    for (let k = 0; k < payload.length; k += 200) {
      setBusy(`글 저장 중 ${Math.min(k + 200, payload.length)}/${payload.length}`);
      const r = await importRowsAction(poolId, payload.slice(k, k + 200), approve);
      if (!r.ok) {
        setBusy(null);
        setMsg({ ok: false, text: r.error });
        return;
      }
      added += r.data.added;
      skipped += r.data.skipped;
    }
    setBusy(null);
    const notes = [
      badRows.length ? `확인이 필요한 줄 ${badRows.length}개 제외` : "",
      skippedByUpload ? `사진 업로드 실패로 ${skippedByUpload}줄 제외(${[...failed.values()][0]})` : "",
      skipped ? `형식 오류 ${skipped}줄 제외` : "",
    ].filter(Boolean);
    setMsg({ ok: true, text: `${added}개를 가져왔습니다${uploaded.size ? `(사진 ${uploaded.size}장)` : ""}${notes.length ? ` · ${notes.join(" · ")}` : ""}.` });
    setRows(null);
    setFiles([]);
    setCsvName("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm text-muted-foreground">
        <p>
          첫 줄에 열 이름: {code("text")}(필수), {code("first_reply")}, {code("topic_tag")}, {code("category")}, {code("images")}(본문 사진, 최대 {CSV_MAX_IMAGES}장, {code("|")}로 구분),{" "}
          {code("reply_image")}(첫 댓글 사진 1장). 엑셀에서 &lsquo;CSV UTF-8&rsquo;로 저장하세요.
        </p>
        <p className="mt-1">사진 칸에는 파일 이름(예: {code("item_1.jpg")})을 적고, 아래에서 그 사진 파일들을 함께 고르면 이름으로 짝지어 올립니다.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={downloadExample}>
          <Download /> 예시 CSV 내려받기
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex cursor-pointer flex-col gap-1 rounded-md border border-dashed bg-background p-3 text-sm hover:bg-accent/40">
          <span className="flex items-center gap-1.5 font-medium">
            <FileSpreadsheet className="size-4" /> 1. CSV 파일
          </span>
          <span className="text-xs text-muted-foreground">{csvName || "눌러서 선택"}</span>
          <input
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              setMsg(null);
              if (!f) return;
              setCsvName(f.name);
              const { headers, rows } = parseCsv(await f.text());
              if (!headers.includes("text")) {
                setRows(null);
                setMsg({ ok: false, text: `'text' 열이 없습니다. 지금 열: ${headers.join(", ") || "(없음)"}` });
                return;
              }
              setRows(rows.filter((r) => r.text?.trim()));
            }}
          />
        </label>
        <label className="flex cursor-pointer flex-col gap-1 rounded-md border border-dashed bg-background p-3 text-sm hover:bg-accent/40">
          <span className="flex items-center gap-1.5 font-medium">
            <ImagePlus className="size-4" /> 2. 사진 파일들 (CSV에 사진을 적었을 때)
          </span>
          <span className="text-xs text-muted-foreground">{files.length ? `${files.length}개 선택됨` : "여러 개 선택 가능"}</span>
          <input
            type="file"
            multiple
            hidden
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
            onChange={(e) => {
              const list = Array.from(e.target.files ?? []);
              e.target.value = "";
              setFiles((prev) => {
                const m = new Map(prev.map((f) => [normalizeFileName(f.name), f]));
                for (const f of list) m.set(normalizeFileName(f.name), f);
                return [...m.values()];
              });
            }}
          />
        </label>
      </div>

      {rows && plan && (
        <div className="flex flex-col gap-2 rounded-md border bg-background p-3 text-sm">
          <div className="font-medium">
            {csvName}: {rows.length}줄 · 가져올 줄 {okRows.length}개 · 필요한 사진 {plan.needed.length}장
          </div>
          {plan.missing.length > 0 && (
            <p className="flex items-start gap-1.5 text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> 선택한 사진 중에 없는 파일 {plan.missing.length}개: {plan.missing.slice(0, 8).join(", ")}
              {plan.missing.length > 8 ? " …" : ""}
            </p>
          )}
          {badRows.length > 0 && (
            <ul className="max-h-32 overflow-y-auto text-xs text-warning">
              {badRows.slice(0, 50).map((r) => (
                <li key={r.index}>
                  {r.index + 2}번째 줄(“{(rows[r.index].text ?? "").slice(0, 20)}…”): {r.error} → 이 줄은 빼고 나머지를 가져옵니다
                </li>
              ))}
            </ul>
          )}
          <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto text-xs text-muted-foreground">
            {okRows.slice(0, 5).map((r) => (
              <li key={r.index} className="truncate">
                {r.index + 2}. {rows[r.index].text}
                {r.images.length ? ` · 사진 ${r.images.length}` : ""}
                {r.replyImage ? " · 댓글 사진" : ""}
              </li>
            ))}
            {okRows.length > 5 && <li>… 외 {okRows.length - 5}줄</li>}
          </ul>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={approve} onChange={(e) => setApprove(e.target.checked)} />
            바로 &lsquo;사용 가능&rsquo;으로 넣기 (끄면 &lsquo;검수 대기&rsquo;)
          </label>
          <div className="flex items-center justify-end gap-3">
            {busy && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> {busy}
              </span>
            )}
            <Button disabled={!!busy || !okRows.length} onClick={() => void runImport()}>
              {okRows.length}개 가져오기
            </Button>
          </div>
        </div>
      )}
      {msg && <p className={msg.ok ? "text-sm text-success" : "text-sm text-destructive"}>{msg.text}</p>}
    </div>
  );
}
