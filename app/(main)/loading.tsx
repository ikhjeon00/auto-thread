export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="불러오는 중">
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      <div className="h-4 w-80 animate-pulse rounded-md bg-muted" />
      <div className="mt-2 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-lg border bg-card" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-lg border bg-card" />
    </div>
  );
}
