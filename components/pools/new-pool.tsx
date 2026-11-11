"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EMPTY_POOL, PoolForm } from "./pool-form";

export function NewPool({ accounts, generators }: { accounts: { id: string; username: string }[]; generators: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus /> 새 창고
      </Button>
    );
  }
  return (
    <Card className="w-full">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>새 창고</CardTitle>
        <Button variant="ghost" size="icon" aria-label="닫기" onClick={() => setOpen(false)}>
          <X />
        </Button>
      </CardHeader>
      <CardContent>
        <PoolForm id={null} initial={EMPTY_POOL} accounts={accounts} generators={generators} onDone={(id) => router.push(`/pools/${id}`)} />
      </CardContent>
    </Card>
  );
}
