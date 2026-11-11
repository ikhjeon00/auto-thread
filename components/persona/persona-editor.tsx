"use client";

import { useEffect, useState, useTransition } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { AGE_LABEL, GENDER_LABEL, JOB_LABEL } from "@/lib/ai/prompt";
import { savePersonaAction, type PersonaInput } from "@/app/(main)/compose/actions";

export const EMPTY_PERSONA: PersonaInput = { age_group: null, gender: null, job: null, tone: null };

function Row<K extends keyof PersonaInput>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Record<string, string>;
  value: PersonaInput[K];
  onChange: (v: PersonaInput[K]) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-12 shrink-0 text-sm text-muted-foreground">{label}</span>
      {Object.entries(options).map(([k, l]) => (
        <Chip key={k} selected={value === k} onClick={() => onChange((value === k ? null : k) as PersonaInput[K])}>
          {l}
        </Chip>
      ))}
    </div>
  );
}

/** 계정 페르소나 편집. 값이 바뀌면 onChange 로 알려 주고, "이 계정에 저장"으로 DB에 저장한다 */
export function PersonaEditor({
  accountId,
  username,
  value,
  onChange,
  onSaved,
}: {
  accountId: string;
  username?: string;
  value: PersonaInput;
  onChange: (v: PersonaInput) => void;
  onSaved?: (v: PersonaInput) => void;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => setMsg(null), [accountId]);
  const set = <K extends keyof PersonaInput>(k: K, v: PersonaInput[K]) => onChange({ ...value, [k]: v });

  return (
    <div className="flex flex-col gap-3">
      <Row<"age_group"> label="연령" options={AGE_LABEL} value={value.age_group} onChange={(v) => set("age_group", v)} />
      <Row<"gender"> label="성별" options={GENDER_LABEL} value={value.gender} onChange={(v) => set("gender", v)} />
      <Row<"job"> label="직업" options={JOB_LABEL} value={value.job} onChange={(v) => set("job", v)} />
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-12 shrink-0 text-sm text-muted-foreground">말투</span>
        <Input
          className="max-w-md flex-1"
          maxLength={300}
          placeholder="예) 다정한 반말, 이모지 가끔, 짧은 문장"
          value={value.tone ?? ""}
          onChange={(e) => set("tone", e.target.value || null)}
        />
      </div>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await savePersonaAction(accountId, value);
              setMsg(r.ok ? { ok: true, text: `${username ? `@${username} ` : ""}계정에 저장했습니다.` } : { ok: false, text: r.error });
              if (r.ok) onSaved?.(value);
            })
          }
        >
          <Save /> 이 계정에 저장
        </Button>
        {msg && <span className={msg.ok ? "text-sm text-success" : "text-sm text-destructive"}>{msg.text}</span>}
      </div>
    </div>
  );
}
