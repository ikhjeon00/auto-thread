import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <div className="text-lg font-extrabold tracking-tight">
        AUTO <span className="text-primary">THREAD</span>
      </div>
      <p className="text-2xl font-bold">페이지를 찾을 수 없습니다</p>
      <p className="text-sm text-muted-foreground">주소가 바뀌었거나 삭제된 항목일 수 있습니다.</p>
      <Link href="/" className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
        대시보드로
      </Link>
    </main>
  );
}
