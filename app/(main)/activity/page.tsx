import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "활동 · AUTO THREAD" };

export default function Page() {
  return (
    <>
      <PageHeader title="활동" description="발행 결과와 오류 알림을 확인합니다." />
      <ComingSoon milestone="M4" />
    </>
  );
}
