export function AccountAvatar({ src, username, size = 36 }: { src: string | null; username: string; size?: number }) {
  return src ? (
    // 외부(Threads CDN) 이미지라 next/image 최적화 대상에서 제외
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-full border object-cover" style={{ width: size, height: size }} />
  ) : (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-muted-foreground"
      style={{ width: size, height: size }}
    >
      {username.slice(0, 1).toUpperCase()}
    </div>
  );
}
