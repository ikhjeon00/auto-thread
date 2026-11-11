import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "수익화 농장 · AUTO THREAD" };

export default function Page() {
  return (
    <>
      <PageHeader title="수익화 농장" description="상품 홍보글을 일상글과 섞어 순환 배치합니다." />
      <ComingSoon milestone="M7" />
    </>
  );
}
