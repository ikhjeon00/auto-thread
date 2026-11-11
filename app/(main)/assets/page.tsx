import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "자료실 · AUTO THREAD" };

export default function Page() {
  return (
    <>
      <PageHeader title="자료실" description="상품 사진·영상을 묶음 단위로 관리합니다." />
      <ComingSoon milestone="M7" />
    </>
  );
}
