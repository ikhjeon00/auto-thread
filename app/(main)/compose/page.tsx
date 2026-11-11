import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "글 작성 · AUTO THREAD" };

export default function Page() {
  return (
    <>
      <PageHeader title="글 작성" description="설정 → 작성 → 발행 3단계로 글을 만들고 예약합니다." />
      <ComingSoon milestone="M3" />
    </>
  );
}
