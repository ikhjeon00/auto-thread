import { PageHeader } from "@/components/layout/page-header";
import { BatchList } from "@/components/farm/batch-list";
import { FarmForm } from "@/components/farm/farm-form";
import { loadFarmPageData } from "@/lib/farm/page-data";

export const metadata = { title: "계정 키우기 농장 · AUTO THREAD" };
export const dynamic = "force-dynamic";
// 만들기를 누른 직후 작업을 바로 이어서 처리한다
export const maxDuration = 300;

export default async function GrowthPage() {
  const d = await loadFarmPageData("growth");
  return (
    <>
      <PageHeader title="계정 키우기 농장" description="여러 계정에 일정 기간 동안 글을 자동으로 만들어 자연스럽게 나눠 예약합니다." />
      <div className="flex flex-col gap-6">
        <FarmForm
          kind="growth"
          accounts={d.accounts}
          tiers={d.tiers}
          pools={d.pools}
          generators={d.generators}
          activeHours={d.settings.activeHours}
          sameAccountGapMinutes={d.settings.sameAccountGapMinutes}
          aiReady={d.aiReady}
          today={d.today}
        />
        <BatchList batches={d.batches} />
      </div>
    </>
  );
}
