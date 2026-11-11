"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { batchDeleteInfoAction, deleteBatchAction } from "@/app/(main)/farm/actions";

const LABEL: Record<string, string> = { draft: "만드는 중", review: "검토 대기", scheduled: "예약", failed: "실패", cancelled: "취소" };

/** 농장 삭제 버튼: 지워질 글·남는 글 수를 보여 주고 확인받는다 */
export function DeleteBatchButton({ batchId, redirectTo, compact = false }: { batchId: string; redirectTo?: string; compact?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const run = () =>
    start(async () => {
      const info = await batchDeleteInfoAction(batchId);
      if (!info.ok) return alert(info.error);
      const { unpublished, published, processing } = info.data;
      if (processing) return alert(`지금 발행 중인 글이 ${processing}개 있습니다. 1~2분 뒤 다시 시도하세요.`);
      const parts = Object.entries(unpublished).map(([s, n]) => `${LABEL[s] ?? s} ${n}개`);
      const lines = [
        "이 농장을 삭제할까요? 되돌릴 수 없습니다.",
        "",
        parts.length ? `함께 삭제: ${parts.join(", ")}` : "함께 삭제할 글: 없음",
        published ? `남는 글: 이미 발행된 ${published}개 (내가 올린 글에 그대로 남음)` : "",
        "창고에서 가져온 글은 창고로 되돌아갑니다.",
      ].filter((l) => l !== "");
      if (!confirm(lines.join("\n"))) return;
      const r = await deleteBatchAction(batchId);
      if (!r.ok) return alert(r.error);
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    });

  return compact ? (
    <Button
      variant="ghost"
      size="icon"
      aria-label="농장 삭제"
      title="농장 삭제"
      className="text-muted-foreground hover:text-destructive"
      disabled={pending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        run();
      }}
    >
      <Trash2 className="size-4" />
    </Button>
  ) : (
    <Button variant="ghost" className="text-muted-foreground hover:text-destructive" disabled={pending} onClick={run}>
      <Trash2 /> {pending ? "삭제 중…" : "농장 삭제"}
    </Button>
  );
}
