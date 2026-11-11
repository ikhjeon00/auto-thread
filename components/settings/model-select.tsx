"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import type { Provider } from "@/lib/ai/types";
import { listModelsAction } from "@/app/(main)/settings/ai-actions";

// 같은 회사 목록을 여러 칸에서 쓰므로 한 번만 불러온다
const cache = new Map<Provider, Promise<{ ok: true; data: string[] } | { ok: false; error: string }>>();
const listeners = new Set<() => void>();

export function loadModels(p: Provider, force = false) {
  if (force || !cache.has(p)) {
    cache.set(p, listModelsAction(p));
    listeners.forEach((l) => l());
  }
  return cache.get(p)!;
}

const MANUAL = "__manual__";

/** 회사의 모델 목록에서 고르는 칸. 목록에 없으면 직접 입력할 수 있다 */
export function ModelSelect({
  provider,
  value,
  onChange,
  id,
  disabled,
  placeholder = "모델 선택",
}: {
  provider: Provider | null;
  value: string;
  onChange: (v: string) => void;
  id?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [list, setList] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [manual, setManual] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  useEffect(() => {
    if (!provider) return;
    let alive = true;
    setLoading(true);
    setError(null);
    loadModels(provider).then((r) => {
      if (!alive) return;
      setLoading(false);
      if (r.ok) setList(r.data);
      else {
        setList(null);
        setError(r.error);
      }
    });
    return () => {
      alive = false;
    };
  }, [provider, tick]);

  if (!provider) {
    return (
      <NativeSelect id={id} disabled value="">
        <option value="">기본 모델 사용</option>
      </NativeSelect>
    );
  }

  const showInput = manual || (!loading && !list);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        {showInput ? (
          <Input id={id} className="flex-1" disabled={disabled} placeholder="모델 이름 직접 입력" value={value} onChange={(e) => onChange(e.target.value.trim())} />
        ) : (
          <NativeSelect
            id={id}
            className="flex-1"
            disabled={disabled || loading}
            value={value}
            onChange={(e) => {
              if (e.target.value === MANUAL) setManual(true);
              else onChange(e.target.value);
            }}
          >
            <option value="">{loading ? "모델 목록 불러오는 중…" : placeholder}</option>
            {value && list && !list.includes(value) && <option value={value}>{value} (목록에 없음)</option>}
            {(list ?? []).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
            <option value={MANUAL}>직접 입력…</option>
          </NativeSelect>
        )}
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="모델 목록 다시 불러오기"
          title={manual ? "목록에서 고르기" : "모델 목록 다시 불러오기"}
          onClick={() => {
            setManual(false);
            void loadModels(provider, true);
          }}
        >
          <RefreshCw className={loading ? "animate-spin" : undefined} />
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">모델 목록을 불러오지 못했습니다: {error}</p>}
    </div>
  );
}
