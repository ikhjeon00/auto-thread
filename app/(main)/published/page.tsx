import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "내가 올린 글 · AUTO THREAD" };

export default function Page() {
  return (
    <>
      <PageHeader title="내가 올린 글" description="발행된 글과 성과를 확인합니다." />
      <ComingSoon milestone="M4" />
    </>
  );
}
