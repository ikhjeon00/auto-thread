"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** 화면을 그리다 난 오류: 원인을 짧게 보여 주고 다시 시도할 수 있게 한다 */
export default function MainError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const network = /fetch failed|ECONNREFUSED|ENOTFOUND/.test(error.message);
  const env = /환경변수/.test(error.message);
  return (
    <Card className="mx-auto mt-10 max-w-lg">
      <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
        <AlertTriangle className="size-10 text-destructive" />
        <p className="text-lg font-semibold">화면을 불러오지 못했습니다</p>
        <p className="text-sm text-muted-foreground">
          {env
            ? error.message
            : network
              ? "데이터베이스(Supabase)에 연결하지 못했습니다. Supabase 프로젝트가 일시 중지되지 않았는지, Vercel 환경변수가 맞는지 확인하세요."
              : "잠시 뒤 다시 시도하세요. 같은 문제가 계속되면 Vercel 로그를 확인하세요."}
        </p>
        {error.digest && <p className="num text-xs text-muted-foreground">오류 번호: {error.digest}</p>}
        <Button onClick={reset}>
          <RotateCcw /> 다시 시도
        </Button>
      </CardContent>
    </Card>
  );
}
