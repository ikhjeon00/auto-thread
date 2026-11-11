import Link from "next/link";
import { ChevronRight, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addDays } from "@/lib/calendar";
import { formatKst } from "@/lib/time";
import type { BatchSummary } from "@/lib/farm/page-data";

const LABEL: Record<string, string> = { review: "검토 대기", scheduled: "예약", published: "발행됨", failed: "실패", cancelled: "취소", draft: "만드는 중", processing: "발행 중" };

export function BatchList({ batches }: { batches: BatchSummary[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>만든 농장</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        {batches.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-muted-foreground">아직 만든 농장이 없습니다.</p>
        ) : (
          <ul className="divide-y border-t">
            {batches.map((b) => {
              const building = b.job && (b.job.status === "queued" || b.job.status === "running");
              const cancelled = b.status === "cancelled";
              return (
                <li key={b.batchId}>
                  <Link href={`/farm/batch/${b.batchId}`} className="flex items-center gap-3 px-5 py-3 hover:bg-accent/50">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 text-sm">
                        <span className="num font-medium">
                          {b.startDate} ~ {addDays(b.startDate, b.days - 1)}
                        </span>
                        <Badge variant="outline">{b.mode === "review" ? "검토 모드" : "자동 모드"}</Badge>
                        {building && (
                          <Badge variant="warning">
                            <Loader2 className="size-3 animate-spin" /> 만드는 중
                          </Badge>
                        )}
                        {b.job?.status === "failed" && !cancelled && <Badge variant="error">만들기 실패</Badge>}
                        {cancelled && <Badge>취소됨</Badge>}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{b.usernames.map((u) => `@${u}`).join(", ")}</div>
                      <div className="num mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                        {Object.entries(b.counts).map(([s, n]) => (
                          <span key={s}>
                            {LABEL[s] ?? s} {n}
                          </span>
                        ))}
                        <span>· {formatKst(b.createdAt, "M/d HH:mm")} 생성</span>
                      </div>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
