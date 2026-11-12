import { PageHeader } from "@/components/layout/page-header";
import { BatchList } from "@/components/farm/batch-list";
import { FarmForm } from "@/components/farm/farm-form";
import { ProductsSection, type ProductView } from "@/components/farm/products-section";
import { db } from "@/lib/db/admin";
import { loadFarmPageData } from "@/lib/farm/page-data";
import type { DisclosureLite } from "@/lib/compose/plan";

export const metadata = { title: "수익화 농장 · AUTO THREAD" };
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function MonetizePage() {
  const [d, prodRes, discRes] = await Promise.all([
    loadFarmPageData("monetize"),
    db().from("products").select("id, name, affiliate_url, disclosure_id, media, memo, is_active").order("created_at", { ascending: false }),
    db().from("disclosures").select("id, name, text, match_domains, default_position, is_default").order("is_default", { ascending: false }),
  ]);
  const products = (prodRes.data ?? []) as ProductView[];
  return (
    <>
      <PageHeader title="수익화 농장" description="상품 홍보글을 일상글과 섞어 기간 동안 순환 배치합니다." />
      <div className="flex flex-col gap-6">
        <ProductsSection products={products} disclosures={(discRes.data ?? []) as (DisclosureLite & { is_default: boolean })[]} />
        <FarmForm
          kind="monetize"
          accounts={d.accounts}
          tiers={d.tiers}
          pools={d.pools}
          generators={d.generators}
          products={products.map((p) => ({ id: p.id, name: p.name, thumb: p.media[0]?.publicUrl ?? null, is_active: p.is_active }))}
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
