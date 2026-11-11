"use client";

import { Fragment } from "react";
import { ChevronRight, Heart, MessageCircle, MoreHorizontal, Repeat2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractUrls, hostOf } from "@/lib/compose/plan";

export type PreviewMedia = { url: string; mediaType: "image" | "video" };

type Props = {
  username: string;
  avatarUrl: string | null;
  mainText: string;
  media: PreviewMedia[];
  replies: { text: string; media: PreviewMedia | null }[];
  linkAttachment: string | null;
  topicTag: string | null;
  isAiLabel: boolean;
};

const URL_SPLIT = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;

function RichText({ text }: { text: string }) {
  return (
    <p className="text-[15px] leading-[1.4] break-words whitespace-pre-wrap">
      {text.split(URL_SPLIT).map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="text-[#0095f6]">
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </p>
  );
}

function Avatar({ src, username }: { src: string | null; username: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="size-9 rounded-full border object-cover" />
  ) : (
    <div className="flex size-9 items-center justify-center rounded-full bg-neutral-200 text-sm font-semibold text-neutral-500">
      {username.slice(0, 1).toUpperCase() || "?"}
    </div>
  );
}

function Actions() {
  return (
    <div className="mt-2.5 -ml-1.5 flex items-center gap-3 text-neutral-700">
      {[Heart, MessageCircle, Repeat2, Send].map((Icon, i) => (
        <span key={i} className="inline-flex size-8 items-center justify-center rounded-full">
          <Icon className="size-[19px]" strokeWidth={1.8} />
        </span>
      ))}
    </div>
  );
}

function MediaView({ media }: { media: PreviewMedia[] }) {
  if (!media.length) return null;
  if (media.length === 1) {
    const m = media[0];
    return (
      <div className="mt-2 overflow-hidden rounded-xl border">
        {m.mediaType === "video" ? (
          <video src={m.url} className="max-h-[420px] w-full bg-black object-contain" muted playsInline controls />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.url} alt="" className="max-h-[420px] w-full object-cover" />
        )}
      </div>
    );
  }
  return (
    <div className="-mr-4 mt-2 flex snap-x gap-1.5 overflow-x-auto pr-4 pb-1 [scrollbar-width:none]">
      {media.map((m, i) =>
        m.mediaType === "video" ? (
          <video key={i} src={m.url} className="h-60 w-auto shrink-0 snap-start rounded-xl border bg-black" muted playsInline />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={m.url} alt="" className="h-60 w-auto max-w-[220px] shrink-0 snap-start rounded-xl border object-cover" />
        ),
      )}
    </div>
  );
}

function Item({
  username,
  avatarUrl,
  text,
  media = [],
  linkAttachment,
  topicTag,
  isAiLabel,
  hasNext,
  time,
}: {
  username: string;
  avatarUrl: string | null;
  text: string;
  media?: PreviewMedia[];
  linkAttachment?: string | null;
  topicTag?: string | null;
  isAiLabel?: boolean;
  hasNext: boolean;
  time: string;
}) {
  return (
    <div className="flex gap-3 px-4 pt-3">
      <div className="flex flex-col items-center">
        <Avatar src={avatarUrl} username={username} />
        {hasNext && <div className="mt-1.5 w-0.5 flex-1 rounded-full bg-neutral-200" />}
      </div>
      <div className={cn("min-w-0 flex-1", hasNext ? "pb-3" : "pb-4")}>
        <div className="flex items-center gap-1 text-[15px]">
          <span className="truncate font-semibold">{username || "계정"}</span>
          {topicTag && (
            <>
              <ChevronRight className="size-3.5 shrink-0 text-neutral-400" />
              <span className="truncate text-neutral-500">{topicTag}</span>
            </>
          )}
          <span className="ml-1 shrink-0 text-neutral-400">{time}</span>
          <MoreHorizontal className="ml-auto size-5 shrink-0 text-neutral-500" />
        </div>
        {text && <RichText text={text} />}
        <MediaView media={media} />
        {linkAttachment && (
          <div className="mt-2 overflow-hidden rounded-xl border">
            <div className="h-24 bg-neutral-100" />
            <div className="px-3 py-2">
              <div className="text-xs text-neutral-500">{hostOf(linkAttachment)}</div>
              <div className="truncate text-sm font-medium">{linkAttachment}</div>
            </div>
          </div>
        )}
        {isAiLabel && <div className="mt-1.5 text-xs text-neutral-500">AI 정보</div>}
        <Actions />
      </div>
    </div>
  );
}

/** Threads 모바일 화면 흉내. 실제 화면과 세부 모양은 다를 수 있다. */
export function ThreadPreview(p: Props) {
  const replies = p.replies.filter((r) => r.text || r.media);
  const empty = !p.mainText && !p.media.length;
  return (
    <div className="mx-auto w-full max-w-[380px] overflow-hidden rounded-[28px] border-[6px] border-neutral-900 bg-white text-neutral-900 shadow-lg">
      <div className="flex h-11 items-center justify-center border-b text-sm font-semibold">스레드</div>
      <div className="max-h-[680px] min-h-[420px] overflow-y-auto">
        {empty ? (
          <p className="px-6 py-20 text-center text-sm text-neutral-400">본문을 입력하면 여기에 미리보기가 나옵니다.</p>
        ) : (
          <>
            <Item
              username={p.username}
              avatarUrl={p.avatarUrl}
              text={p.mainText}
              media={p.media}
              linkAttachment={p.linkAttachment}
              topicTag={p.topicTag}
              isAiLabel={p.isAiLabel}
              hasNext={replies.length > 0}
              time="방금"
            />
            {replies.map((r, i) => (
              <Item
                key={i}
                username={p.username}
                avatarUrl={p.avatarUrl}
                text={r.text}
                media={r.media ? [r.media] : []}
                linkAttachment={!r.media ? (extractUrls(r.text)[0] ?? null) : null}
                hasNext={i < replies.length - 1}
                time="방금"
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
