import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function TesterGuide() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>테스터 초대 수락 방법</CardTitle>
        <CardDescription>앱이 개발 모드라서, 테스터로 등록된 계정만 연결할 수 있습니다.</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm leading-relaxed">
          <li>
            <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className="text-primary underline">
              Meta 앱 대시보드
            </a>
            {" "}→ 앱 선택 → <b>앱 역할 → 역할</b> → <b>사람 추가</b> → <b>Threads 테스터</b>를 고르고 계정 이름을 입력해 초대합니다.
          </li>
          <li>
            초대받은 계정으로 Threads에 로그인한 뒤 <b>설정 → 계정 → 웹사이트 권한 → 초대</b>에서 초대를 <b>수락</b>합니다.
            (웹: threads.com → 왼쪽 아래 메뉴 → 설정)
          </li>
          <li>
            이 화면에서 <b>계정 연결</b>을 누릅니다. 브라우저에 다른 Threads 계정이 로그인돼 있으면 그 계정이 연결되니, 먼저 연결할 계정으로
            전환하세요.
          </li>
          <li>연결 후 <b>테스트 발행</b>으로 글이 실제로 올라가는지 확인합니다.</li>
        </ol>
      </CardContent>
    </Card>
  );
}
