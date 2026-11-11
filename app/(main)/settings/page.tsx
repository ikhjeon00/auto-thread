import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "설정 · AUTO THREAD" };

export default function Page() {
  return (
    <>
      <PageHeader title="설정" description="계정 연결, 페르소나, 고지 문구, AI 생성기 등을 관리합니다." />
      <ComingSoon milestone="M2" />
    </>
  );
}
