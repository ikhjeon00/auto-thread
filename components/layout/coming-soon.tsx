import { Card, CardContent } from "@/components/ui/card";

export function ComingSoon({ milestone }: { milestone: string }) {
  return (
    <Card>
      <CardContent className="py-10 text-center text-sm text-muted-foreground">
        이 화면은 <span className="font-semibold text-foreground">{milestone}</span> 단계에서 만들어집니다.
      </CardContent>
    </Card>
  );
}
