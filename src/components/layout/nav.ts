import { Hammer, Library, LayoutDashboard, Search, Settings, WandSparkles } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/decks", label: "Decks", icon: Library },
  { href: "/builder", label: "Deck Builder", icon: Hammer },
  { href: "/search", label: "Card Search", icon: Search },
  { href: "/upgrade", label: "Upgrade Workshop", icon: WandSparkles },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;
