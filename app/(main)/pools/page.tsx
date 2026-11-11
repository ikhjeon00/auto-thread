import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "글 창고 · AUTO THREAD" };

export default function Page() {
  return (
    <>
      <PageHeader title="글 창고" description="발행할 글을 모아두고 랜덤으로 꺼내 씁니다." />
      <ComingSoon milestone="M6" />
    </>
  );
}
