"use client";

import { useRef, useState } from "react";
import { GripVertical, ImagePlus, Images, Loader2, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_MEDIA, type MediaItem } from "@/lib/compose/schema";
import { prepareFile } from "@/lib/media/prepare";
import { uploadPrepared } from "@/lib/media/upload";
import { cn } from "@/lib/utils";

type Uploading = { key: string; name: string; previewUrl: string | null };

export function MediaPicker({
  value,
  onChange,
  max = MAX_MEDIA,
  compact = false,
  folder = "uploads",
}: {
  value: MediaItem[];
  onChange: (v: MediaItem[]) => void;
  max?: number;
  compact?: boolean;
  folder?: "uploads" | "assets";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<Uploading[]>([]);
  const [messages, setMessages] = useState<{ level: "error" | "warn"; text: string }[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const latest = useRef(value);
  latest.current = value;

  const remaining = max - value.length - uploading.length;

  async function addFiles(list: FileList | File[]) {
    const files = Array.from(list);
    if (!files.length) return;
    const msgs: { level: "error" | "warn"; text: string }[] = [];
    if (files.length > remaining) {
      msgs.push({ level: "error", text: `최대 ${max}개까지 올릴 수 있어서 ${files.length - Math.max(remaining, 0)}개는 제외했습니다.` });
    }
    const picked = files.slice(0, Math.max(remaining, 0));
    const pending: Uploading[] = picked.map((f) => ({
      key: `${f.name}-${f.size}-${Math.random()}`,
      name: f.name,
      previewUrl: f.type.startsWith("image/") && !/hei[cf]/i.test(f.type) ? URL.createObjectURL(f) : null,
    }));
    setUploading((u) => [...u, ...pending]);
    setMessages(msgs);

    // 하나씩 처리해 실패한 파일만 빠지게 한다
    for (let i = 0; i < picked.length; i++) {
      const f = picked[i];
      try {
        const prepared = await prepareFile(f);
        prepared.warnings.forEach((w) => msgs.push({ level: "warn", text: `${f.name}: ${w}` }));
        const [item] = await uploadPrepared([prepared], folder);
        onChange([...latest.current, item]);
      } catch (e) {
        msgs.push({ level: "error", text: e instanceof Error ? e.message : `${f.name}: 업로드 실패` });
      } finally {
        const p = pending[i];
        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
        setUploading((u) => u.filter((x) => x.key !== p.key));
        setMessages([...msgs]);
      }
    }
  }

  function move(from: number, to: number) {
    if (from === to || to < 0 || to >= value.length) return;
    const next = [...value];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={remaining <= 0} onClick={() => inputRef.current?.click()}>
          <ImagePlus /> {compact ? "사진·영상 붙이기" : "직접 추가"}
        </Button>
        {!compact && (
          <Button type="button" variant="outline" size="sm" disabled title="자료실은 M7 단계에서 추가됩니다">
            <Images /> 자료실에서 고르기
          </Button>
        )}
        <span className="num text-xs text-muted-foreground">
          {value.length} / {max}
        </span>
        <input
          ref={inputRef}
          type="file"
          multiple={max > 1}
          hidden
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,video/mp4,video/quicktime,.mov"
          onChange={(e) => {
            if (e.target.files) void addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {!(compact && value.length === 0 && uploading.length === 0) && (
      <div
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) {
            e.preventDefault();
            setDropActive(true);
          }
        }}
        onDragLeave={() => setDropActive(false)}
        onDrop={(e) => {
          if (e.dataTransfer.files.length) {
            e.preventDefault();
            setDropActive(false);
            void addFiles(e.dataTransfer.files);
          }
        }}
        className={cn(
          "rounded-lg border border-dashed p-3 transition-colors",
          dropActive ? "border-primary bg-primary-soft" : "border-input bg-background",
        )}
      >
        {value.length === 0 && uploading.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            사진·영상을 여기로 끌어 놓거나 &lsquo;직접 추가&rsquo;를 누르세요.
            <br />
            <span className="text-xs">HEIC·WebP는 JPEG로 바뀌고, 가로 1440px로 줄여서 올립니다.</span>
          </p>
        ) : (
          <ul className={cn("grid gap-2", compact ? "w-28 grid-cols-1" : "grid-cols-3 sm:grid-cols-4 md:grid-cols-5")}>
            {value.map((m, i) => (
              <li
                key={m.storagePath}
                draggable
                onDragStart={(e) => {
                  setDragIdx(i);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  if (dragIdx !== null) e.preventDefault();
                }}
                onDrop={(e) => {
                  if (dragIdx !== null) {
                    e.preventDefault();
                    e.stopPropagation();
                    move(dragIdx, i);
                    setDragIdx(null);
                  }
                }}
                onDragEnd={() => setDragIdx(null)}
                className={cn(
                  "group relative aspect-square cursor-grab overflow-hidden rounded-md border bg-card",
                  dragIdx === i && "opacity-40",
                )}
              >
                {m.mediaType === "video" ? (
                  <div className="relative size-full bg-black">
                    <video src={m.publicUrl} className="size-full object-cover" muted playsInline preload="metadata" />
                    <Video className="absolute bottom-1.5 left-1.5 size-4 text-white" />
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.publicUrl} alt="" className="size-full object-cover" draggable={false} />
                )}
                <span className="num absolute top-1 left-1 rounded bg-black/60 px-1.5 text-xs text-white">{i + 1}</span>
                <GripVertical className="absolute top-1 left-1/2 size-4 -translate-x-1/2 text-white opacity-0 drop-shadow group-hover:opacity-100" />
                <button
                  type="button"
                  aria-label={`${i + 1}번째 삭제`}
                  onClick={() => onChange(value.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 inline-flex size-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-destructive"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
            {uploading.map((u) => (
              <li key={u.key} className="relative flex aspect-square items-center justify-center overflow-hidden rounded-md border bg-muted">
                {u.previewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.previewUrl} alt="" className="absolute inset-0 size-full object-cover opacity-40" />
                )}
                <Loader2 className="relative size-5 animate-spin text-muted-foreground" />
              </li>
            ))}
          </ul>
        )}
      </div>
      )}
      {value.length > 1 && <p className="text-xs text-muted-foreground">끌어서 순서를 바꿀 수 있습니다. 2개 이상이면 캐러셀로 올라갑니다.</p>}
      {messages.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {messages.map((m, i) => (
            <li key={i} className={m.level === "error" ? "text-destructive" : "text-warning"}>
              {m.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
