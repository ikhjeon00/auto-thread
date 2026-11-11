import Link from "next/link";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { AccountsSection } from "@/components/settings/accounts-section";
import { GroupsSection } from "@/components/settings/groups-section";
import { TesterGuide } from "@/components/settings/tester-guide";
import { DisclosuresSection, type DisclosureView } from "@/components/settings/disclosures-section";
import { GeneralSection } from "@/components/settings/general-section";
import { PersonasSection } from "@/components/settings/personas-section";
import { TiersSection } from "@/components/settings/tiers-section";
import { AiSection } from "@/components/settings/ai-section";
import { GeneratorsSection, type GeneratorView } from "@/components/settings/generators-section";
import { FormatsSection, TopicsSection, type FormatView, type TopicView } from "@/components/settings/topics-section";
import type { AccountView, GroupView } from "@/components/settings/types";
import { DEFAULT_SETTINGS, getSettings } from "@/lib/settings";
import { getAiSettings, keyStatuses } from "@/lib/ai/config";
import { monthlyAiCost } from "@/lib/ai/generate";
import { priceKey } from "@/lib/ai/pricing";
import { db } from "@/lib/db/admin";
import { cn } from "@/lib/utils";
import type { PersonaInput } from "../compose/actions";

export const metadata = { title: "설정 · AUTO THREAD" };
export const dynamic = "force-dynamic";
// 테스트 발행(서버 액션)이 컨테이너 상태를 기다리므로 여유를 둔다
export const maxDuration = 60;

const TABS = [
  ["accounts", "계정"],
  ["content", "글 설정"],
  ["ai", "AI"],
  ["topics", "주제·형식"],
] as const;
type Tab = (typeof TABS)[number][0];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string; connected?: string; error?: string }> }) {
  const sp = await searchParams;
  const tab: Tab = TABS.some(([t]) => t === sp.tab) ? (sp.tab as Tab) : "accounts";

  return (
    <>
      <PageHeader title="설정" description="계정 연결, 페르소나, 고지 문구, AI 생성기 등을 관리합니다." />
      <nav className="mb-6 flex gap-1 overflow-x-auto border-b">
        {TABS.map(([t, label]) => (
          <Link
            key={t}
            href={`/settings?tab=${t}`}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm whitespace-nowrap transition-colors",
              tab === t ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="flex flex-col gap-6">
        {sp.connected && <Banner ok>@{sp.connected} 계정을 연결했습니다.</Banner>}
        {sp.error && <Banner>{sp.error}</Banner>}
        {tab === "accounts" && <AccountsTab />}
        {tab === "content" && <ContentTab />}
        {tab === "ai" && <AiTab />}
        {tab === "topics" && <TopicsTab />}
      </div>
    </>
  );
}

async function AccountsTab() {
  const [accRes, groupRes, personaRes] = await Promise.all([
    db()
      .from("threads_accounts")
      .select("id, username, profile_picture_url, status, group_id, daily_post_limit, token_expires_at, token_refreshed_at, follower_count")
      .order("created_at"),
    db().from("account_groups").select("id, name, color").order("name"),
    db().from("personas").select("account_id, age_group, gender, job, tone"),
  ]);
  const loadError = accRes.error?.message ?? groupRes.error?.message;
  const accounts = (accRes.data ?? []) as AccountView[];
  const personas: Record<string, PersonaInput> = Object.fromEntries(
    ((personaRes.data ?? []) as (PersonaInput & { account_id: string })[]).map(({ account_id, ...p }) => [account_id, p]),
  );
  return (
    <>
      {loadError && <Banner>데이터를 불러오지 못했습니다: {loadError}</Banner>}
      <AccountsSection accounts={accounts} groups={(groupRes.data ?? []) as GroupView[]} />
      <PersonasSection accounts={accounts.filter((a) => a.status !== "disabled")} personas={personas} />
      <div className="grid gap-6 xl:grid-cols-2">
        <GroupsSection groups={(groupRes.data ?? []) as GroupView[]} />
        <TesterGuide />
      </div>
    </>
  );
}

async function ContentTab() {
  const [discRes, settings, tierRes] = await Promise.all([
    db().from("disclosures").select("id, name, text, match_domains, is_default, default_position").order("name"),
    getSettings().catch(() => DEFAULT_SETTINGS),
    db().from("app_settings").select("value").eq("key", "follower_tiers").maybeSingle(),
  ]);
  return (
    <>
      <DisclosuresSection items={(discRes.data ?? []) as DisclosureView[]} />
      <GeneralSection
        initial={{
          activeHours: settings.activeHours,
          bannedWords: settings.bannedWords,
          globalDailyLimit: settings.globalDailyLimit,
          defaultDailyPostLimit: settings.defaultDailyPostLimit,
          minGapMinutes: settings.minGapMinutes,
          sameAccountGapMinutes: settings.sameAccountGapMinutes,
          poolEmptyBehavior: settings.poolEmptyBehavior,
        }}
      />
      <TiersSection initial={(tierRes.data?.value as { min: number; max: number | null; daily_posts: number }[] | undefined) ?? [{ min: 0, max: null, daily_posts: 3 }]} />
    </>
  );
}

async function AiTab() {
  const [ai, genRes, monthly, logRes, keys] = await Promise.all([
    getAiSettings(),
    db().from("generators").select("id, name, version, kind, system_prompt, user_prompt_template, provider, model, example_count, is_active").order("created_at"),
    monthlyAiCost(),
    db().from("generation_logs").select("provider, model").order("created_at", { ascending: false }).limit(200),
    keyStatuses(),
  ]);
  const generators = (genRes.data ?? []) as GeneratorView[];
  const used = [
    ai.defaults.text.model ? priceKey(ai.defaults.text) : null,
    ai.defaults.vision.model ? priceKey(ai.defaults.vision) : null,
    ...generators.filter((g) => g.provider && g.model).map((g) => `${g.provider}:${g.model}`),
    ...((logRes.data ?? []) as { provider: string | null; model: string }[]).filter((l) => l.provider).map((l) => `${l.provider}:${l.model}`),
  ].filter((x): x is string => !!x);

  return (
    <>
      <AiSection keys={keys} defaults={ai.defaults} pricing={ai.pricing} usedModels={[...new Set(used)]} monthly={monthly} />
      <GeneratorsSection items={generators} />
    </>
  );
}

async function TopicsTab() {
  const [topicRes, formatRes] = await Promise.all([
    db().from("topics").select("id, category, topic, keywords, last_used_at").order("category").order("topic").limit(2000),
    db().from("post_formats").select("id, name, instruction, is_active").order("name"),
  ]);
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <TopicsSection topics={(topicRes.data ?? []) as TopicView[]} />
      <FormatsSection formats={(formatRes.data ?? []) as FormatView[]} />
    </div>
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
