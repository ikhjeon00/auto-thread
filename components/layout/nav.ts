import {
  Activity,
  Archive,
  CalendarClock,

  Gem,
  Images,
  LayoutDashboard,
  PenSquare,
  Send,
  Settings,
  ShoppingBag,
  Sprout,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };
export type NavSection = { title?: string; items: NavItem[] };

export const NAV: NavSection[] = [
  {
    title: "글 만들기",
    items: [
      { href: "/", label: "대시보드", icon: LayoutDashboard },
      { href: "/compose", label: "글 작성", icon: PenSquare },
      { href: "/farm/growth", label: "계정 키우기 농장", icon: Sprout },
      { href: "/farm/monetize", label: "수익화 농장", icon: ShoppingBag },
    ],
  },
  {
    title: "글감·보관",
    items: [
      { href: "/pools", label: "글 창고", icon: Archive },
      { href: "/bookmarks", label: "보석함", icon: Gem },
      { href: "/assets", label: "자료실", icon: Images },
    ],
  },
  {
    title: "발행 관리",
    items: [
      { href: "/scheduled", label: "예약한 글", icon: CalendarClock },
      { href: "/published", label: "내가 올린 글", icon: Send },
      { href: "/activity", label: "활동", icon: Activity },
    ],
  },
  { items: [{ href: "/settings", label: "설정", icon: Settings }] },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

export function findNavItem(pathname: string): NavItem | undefined {
  return NAV.flatMap((s) => s.items).find((i) => isActive(pathname, i.href));
}

