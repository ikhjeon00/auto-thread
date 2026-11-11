import { CheckCircle2, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { AccountsSection } from "@/components/settings/accounts-section";
import { GroupsSection } from "@/components/settings/groups-section";
import { TesterGuide } from "@/components/settings/tester-guide";
import { DisclosuresSection, type DisclosureView } from "@/components/settings/disclosures-section";
import { GeneralSection } from "@/components/settings/general-section";
import { DEFAULT_SETTINGS, getSettings } from "@/lib/settings";
import type { AccountView, GroupView } from "@/components/settings/types";
import { db } from "@/lib/db/admin";

export const metadata = { title: "설정 · AUTO THREAD" };
export const dynamic = "force-dynamic";
// 테스트 발행(서버 액션)이 컨테이너 상태를 기다리므로 여유를 둔다
export const maxDuration = 60;

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const { connected, error } = await searchParams;
  const [accRes, groupRes, discRes, settings] = await Promise.all([
    db()
      .from("threads_accounts")
      .select("id, username, profile_picture_url, status, group_id, daily_post_limit, token_expires_at, token_refreshed_at, follower_count")
      .order("created_at"),
    db().from("account_groups").select("id, name, color").order("name"),
    db().from("disclosures").select("id, name, text, match_domains, is_default, default_position").order("name"),
    getSettings().catch(() => DEFAULT_SETTINGS),
  ]);
  const loadError = accRes.error?.message ?? groupRes.error?.message;

  return (
    <>
      <PageHeader title="설정" description="계정 연결, 페르소나, 고지 문구, AI 생성기 등을 관리합니다." />
      <div className="flex flex-col gap-6">
        {connected && (
          <Banner ok>
            @{connected} 계정을 연결했습니다.
          </Banner>
        )}
        {error && <Banner>{error}</Banner>}
        {loadError && <Banner>데이터를 불러오지 못했습니다: {loadError}</Banner>}

        <AccountsSection accounts={(accRes.data ?? []) as AccountView[]} groups={(groupRes.data ?? []) as GroupView[]} />
        <div className="grid gap-6 xl:grid-cols-2">
          <GroupsSection groups={(groupRes.data ?? []) as GroupView[]} />
          <TesterGuide />
        </div>
        <DisclosuresSection items={(discRes.data ?? []) as DisclosureView[]} />
        <GeneralSection
          initial={{
            activeHours: settings.activeHours,
            bannedWords: settings.bannedWords,
            globalDailyLimit: settings.globalDailyLimit,
            defaultDailyPostLimit: settings.defaultDailyPostLimit,
            minGapMinutes: settings.minGapMinutes,
            sameAccountGapMinutes: settings.sameAccountGapMinutes,
          }}
        />
      </div>
    </>
  );
}

function Banner({ ok = false, children }: { ok?: boolean; children: React.ReactNode }) {
  const Icon = ok ? CheckCircle2 : AlertCircle;
  return (
    <div
      role="status"
      className={
        ok
          ? "flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-success"
          : "flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-destructive"
      }
    >
      <Icon className="size-4 shrink-0" />
      {children}
    </div>
  );
}
