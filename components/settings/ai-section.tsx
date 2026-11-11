"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Download, Plus, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { PROVIDER_LABEL, PROVIDERS, type ModelRef, type Provider } from "@/lib/ai/types";
import type { PricingTable } from "@/lib/ai/pricing";
import { listModelsAction, saveAiDefaultsAction, savePricingAction } from "@/app/(main)/settings/ai-actions";

type Props = {
  keys: Record<Provider, boolean>;
  defaults: { text: ModelRef; vision: ModelRef };
  pricing: PricingTable;
  /** 단가표에 미리 보여 줄 모델(기본 모델, 생성기, 최근 사용) */
  usedModels: string[];
  monthly: { total: number; byModel: { key: string; usd: number; calls: number }[] };
};

const fmtUsd = (v: number) => "$" + v.toFixed(v < 1 ? 4 : 2);

export function AiSection(p: Props) {
  const [models, setModels] = useState<Partial<Record<Provider, string[]>>>({});
  const [loading, setLoading] = useState<Provider | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const loadModels = async (prov: Provider) => {
    setLoading(prov);
    setListError(null);
    const r = await listModelsAction(prov);
    setLoading(null);
    if (r.ok) setModels((m) => ({ ...m, [prov]: r.data }));
    else setListError(r.error);
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>AI 연결 상태</CardTitle>
          <CardDescription>키는 Vercel 환경변수에만 넣습니다. 넣은 뒤에는 Redeploy 해야 반영됩니다.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {PROVIDERS.map((prov) => (
            <div key={prov} className="flex items-center justify-between gap-3 rounded-md border bg-background px-4 py-3">
              <div>
                <div className="font-medium">{PROVIDER_LABEL[prov]}</div>
                <div className="text-xs text-muted-foreground">{prov === "openai" ? "OPENAI_API_KEY" : "GEMINI_API_KEY"}</div>
              </div>
              <div className="flex items-center gap-2">
                {p.keys[prov] ? (
                  <span className="flex items-center gap-1 text-sm text-success">
                    <CheckCircle2 className="size-4" /> 연결됨
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <XCircle className="size-4" /> 키 없음
                  </span>
                )}
                <Button size="sm" variant="outline" disabled={!p.keys[prov] || loading === prov} onClick={() => loadModels(prov)}>
                  <Download /> {loading === prov ? "불러오는 중…" : "모델 목록"}
                </Button>
              </div>
            </div>
          ))}
          {listError && <p className="text-sm text-destructive sm:col-span-2">{listError}</p>}
          {Object.entries(models).map(([prov, list]) => (
            <p key={prov} className="text-xs text-muted-foreground sm:col-span-2">
              {PROVIDER_LABEL[prov as Provider]} 모델 {list?.length ?? 0}개를 불러왔습니다. 아래 모델 칸에서 고를 수 있습니다.
            </p>
          ))}
        </CardContent>
      </Card>

      <DefaultsCard defaults={p.defaults} keys={p.keys} models={models} />
      <PricingCard pricing={p.pricing} usedModels={p.usedModels} />

      <Card>
        <CardHeader>
          <CardTitle>이번 달 AI 비용</CardTitle>
          <CardDescription>입력한 단가로 계산한 추정치입니다. 실제 청구액은 각 회사 콘솔에서 확인하세요.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="num text-3xl font-bold">{fmtUsd(p.monthly.total)}</div>
          {p.monthly.byModel.length > 0 ? (
            <ul className="divide-y rounded-md border text-sm">
              {p.monthly.byModel.map((m) => (
                <li key={m.key} className="flex items-center justify-between px-3 py-2">
                  <span className="truncate">{m.key}</span>
                  <span className="num text-muted-foreground">
                    {m.calls}회 · {fmtUsd(m.usd)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">이번 달 사용 기록이 없습니다.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ModelPicker({
  label,
  value,
  onChange,
  keys,
  models,
  id,
}: {
  label: string;
  value: ModelRef;
  onChange: (v: ModelRef) => void;
  keys: Record<Provider, boolean>;
  models: Partial<Record<Provider, string[]>>;
  id: string;
}) {
  const list = models[value.provider] ?? [];
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <NativeSelect className="w-52 shrink-0" value={value.provider} onChange={(e) => onChange({ provider: e.target.value as Provider, model: "" })}>
          {PROVIDERS.map((prov) => (
            <option key={prov} value={prov}>
              {PROVIDER_LABEL[prov]}
              {keys[prov] ? "" : " (키 없음)"}
            </option>
          ))}
        </NativeSelect>
        <Input
          id={id}
          className="flex-1"
          list={`${id}-list`}
          placeholder="모델 이름 (모델 목록에서 고르거나 직접 입력)"
          value={value.model}
          onChange={(e) => onChange({ ...value, model: e.target.value.trim() })}
        />
        <datalist id={`${id}-list`}>
          {list.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </div>
    </div>
  );
}

function DefaultsCard({ defaults, keys, models }: { defaults: Props["defaults"]; keys: Props["keys"]; models: Partial<Record<Provider, string[]>> }) {
  const [v, setV] = useState(defaults);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <Card>
      <CardHeader>
        <CardTitle>기본 모델</CardTitle>
        <CardDescription>생성기에 모델을 따로 지정하지 않으면 이 모델을 씁니다. 사진 이해용은 수익화 농장(상품 사진 보고 글쓰기)에 쓰입니다.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ModelPicker id="m-text" label="글쓰기(텍스트)" value={v.text} onChange={(text) => setV({ ...v, text })} keys={keys} models={models} />
        <ModelPicker id="m-vision" label="사진 이해(비전)" value={v.vision} onChange={(vision) => setV({ ...v, vision })} keys={keys} models={models} />
        <div className="flex items-center justify-end gap-3">
          {msg && <span className={msg.ok ? "text-sm text-success" : "text-sm text-destructive"}>{msg.text}</span>}
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await saveAiDefaultsAction(v);
                setMsg(r.ok ? { ok: true, text: "저장했습니다." } : { ok: false, text: r.error });
              })
            }
          >
            저장
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

type PriceRow = { key: string; input: string; output: string; cached: string };

function PricingCard({ pricing, usedModels }: { pricing: PricingTable; usedModels: string[] }) {
  const keys = [...new Set([...Object.keys(pricing), ...usedModels])].sort();
  const [rows, setRows] = useState<PriceRow[]>(
    keys.map((k) => ({
      key: k,
      input: pricing[k] ? String(pricing[k].input) : "",
      output: pricing[k] ? String(pricing[k].output) : "",
      cached: pricing[k]?.cached !== undefined ? String(pricing[k].cached) : "",
    })),
  );
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const upd = (i: number, patch: Partial<PriceRow>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <Card>
      <CardHeader>
        <CardTitle>모델 단가</CardTitle>
        <CardDescription>
          100만(1M) 토큰당 달러. 각 회사 가격 페이지의 값을 그대로 넣으세요. 비우면 비용을 계산하지 않습니다. 캐시 단가는 모르면 비워 두세요(입력 단가로 계산).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-1 pr-2 font-medium">모델 (회사:모델)</th>
                <th className="w-24 py-1 pr-2 font-medium">입력</th>
                <th className="w-24 py-1 pr-2 font-medium">출력</th>
                <th className="w-24 py-1 pr-2 font-medium">캐시 입력</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="py-1 pr-2">
                    <Input value={r.key} placeholder="gemini:모델이름" onChange={(e) => upd(i, { key: e.target.value.trim() })} />
                  </td>
                  {(["input", "output", "cached"] as const).map((f) => (
                    <td key={f} className="py-1 pr-2">
                      <Input type="number" min={0} step="0.001" className="num" value={r[f]} onChange={(e) => upd(i, { [f]: e.target.value })} />
                    </td>
                  ))}
                  <td>
                    <Button variant="ghost" size="icon" aria-label="행 삭제" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="outline" size="sm" onClick={() => setRows([...rows, { key: "", input: "", output: "", cached: "" }])}>
            <Plus /> 모델 추가
          </Button>
          <div className="flex items-center gap-3">
            {msg && <span className={msg.ok ? "text-sm text-success" : "text-sm text-destructive"}>{msg.text}</span>}
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const table: Record<string, { input: number; output: number; cached?: number }> = {};
                  for (const r of rows) {
                    if (!r.key || r.input === "" || r.output === "") continue;
                    table[r.key] = { input: Number(r.input), output: Number(r.output), ...(r.cached !== "" ? { cached: Number(r.cached) } : {}) };
                  }
                  const res = await savePricingAction(table);
                  setMsg(res.ok ? { ok: true, text: "저장했습니다." } : { ok: false, text: res.error });
                })
              }
            >
              저장
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
