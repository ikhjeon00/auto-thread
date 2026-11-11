import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "계정 키우기 농장 · AUTO THREAD" };

export default function Page() {
  return (
    <>
      <PageHeader title="계정 키우기 농장" description="여러 계정에 일정 기간 동안 글을 자동으로 배치합니다." />
      <ComingSoon milestone="M7" />
    </>
  );
}
