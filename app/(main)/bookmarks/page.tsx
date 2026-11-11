import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "보석함 · AUTO THREAD" };

export default function Page() {
  return (
    <>
      <PageHeader title="보석함" description="반응 좋았던 글과 참고 글을 모아둡니다." />
      <ComingSoon milestone="M9" />
    </>
  );
}
