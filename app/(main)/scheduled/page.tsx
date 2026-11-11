import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "예약한 글 · AUTO THREAD" };

export default function Page() {
  return (
    <>
      <PageHeader title="예약한 글" description="예약된 글을 캘린더와 목록으로 관리합니다." />
      <ComingSoon milestone="M4" />
    </>
  );
}
