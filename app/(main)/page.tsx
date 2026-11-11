import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "대시보드 · AUTO THREAD" };

const SUMMARY = ["연결된 계정", "오늘 발행된 글", "예약된 글", "총 작성된 글"];

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="대시보드" description="계정 현황과 발행 성과를 한눈에 봅니다." />
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {SUMMARY.map((label) => (
          <Card key={label} className="gap-2">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent className="num text-3xl font-bold">–</CardContent>
          </Card>
        ))}
      </div>
      <ComingSoon milestone="M8" />
    </>
  );
}
