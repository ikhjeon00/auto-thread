"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EMPTY_PERSONA, PersonaEditor } from "@/components/persona/persona-editor";
import { AGE_LABEL, GENDER_LABEL, JOB_LABEL } from "@/lib/ai/prompt";
import { cn } from "@/lib/utils";
import type { PersonaInput } from "@/app/(main)/compose/actions";
import { AccountAvatar } from "./account-avatar";

function summary(p: PersonaInput | undefined): string {
  if (!p) return "설정 안 함";
  const parts = [p.age_group && AGE_LABEL[p.age_group], p.gender && GENDER_LABEL[p.gender], p.job && JOB_LABEL[p.job], p.tone].filter(Boolean);
  return parts.length ? parts.join(" · ") : "설정 안 함";
}

export function PersonasSection({
  accounts,
  personas,
}: {
  accounts: { id: string; username: string; profile_picture_url: string | null }[];
  personas: Record<string, PersonaInput>;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [values, setValues] = useState(personas);
  const [saved, setSaved] = useState(personas);

  return (
    <Card>
      <CardHeader>
        <CardTitle>계정별 페르소나</CardTitle>
        <CardDescription>AI가 글을 쓸 때 참고하는 연령·성별·직업·말투입니다. 글 작성 화면에서도 바꿀 수 있습니다.</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {accounts.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted-foreground">연결된 계정이 없습니다.</p>
        ) : (
          <ul className="divide-y border-t">
            {accounts.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => setOpen(open === a.id ? null : a.id)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-accent/50">
                  <AccountAvatar src={a.profile_picture_url} username={a.username} size={32} />
                  <span className="font-medium">@{a.username}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{summary(saved[a.id])}</span>
                  <ChevronDown className={cn("size-4 transition-transform", open === a.id && "rotate-180")} />
                </button>
                {open === a.id && (
                  <div className="px-5 pb-4">
                    <PersonaEditor
                      accountId={a.id}
                      username={a.username}
                      value={values[a.id] ?? EMPTY_PERSONA}
                      onChange={(v) => setValues({ ...values, [a.id]: v })}
                      onSaved={(v) => setSaved({ ...saved, [a.id]: v })}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
