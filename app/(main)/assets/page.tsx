import { PageHeader } from "@/components/layout/page-header";
import { Bundles } from "@/components/assets/bundles";
import { db } from "@/lib/db/admin";
import type { BundleView } from "../farm/actions";

export const metadata = { title: "자료실 · AUTO THREAD" };
export const dynamic = "force-dynamic";

type Row = { id: string; name: string; category: string | null; memo: string | null; assets: { storage_path: string; media_type: "image" | "video"; width: number | null; height: number | null; sort_order: number }[] };

export default async function AssetsPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 100) || null;
  const category = sp.category?.trim() || null;
  let query = db().from("asset_bundles").select("id, name, category, memo, assets(storage_path, media_type, width, height, sort_order)").order("created_at", { ascending: false }).limit(200);
  if (q) query = query.ilike("name", `%${q.replace(/[%_]/g, "")}%`);
  if (category) query = query.eq("category", category);
  const [res, catRes] = await Promise.all([query, db().from("asset_bundles").select("category").not("category", "is", null).limit(2000)]);
  const bucket = process.env.STORAGE_BUCKET || "media";
  const bundles: BundleView[] = ((res.data ?? []) as unknown as Row[]).map((b) => ({
    id: b.id,
    name: b.name,
    category: b.category,
    memo: b.memo,
    media: [...b.assets]
      .sort((x, y) => x.sort_order - y.sort_order)
      .map((a) => ({ storagePath: a.storage_path, publicUrl: db().storage.from(bucket).getPublicUrl(a.storage_path).data.publicUrl, mediaType: a.media_type, width: a.width, height: a.height })),
  }));
  const categories = [...new Set(((catRes.data ?? []) as { category: string }[]).map((c) => c.category))].sort();

  return (
    <>
      <PageHeader title="자료실" description="상품 사진·영상을 묶음으로 모아 두고, 글 작성·창고·수익화 농장에서 꺼내 씁니다. 자료실 파일은 자동 삭제되지 않습니다." />
      {res.error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-destructive">불러오기 실패: {res.error.message}</p>}
      <Bundles bundles={bundles} categories={categories} filter={{ q, category }} />
    </>
  );
}
