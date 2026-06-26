"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/travel", label: "Travel" },
  { href: "/photography", label: "Photography" },
  { href: "/journal", label: "Journal" },
  { href: "/contact", label: "Contact" }
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="fixed left-0 top-0 z-50 w-full border-b border-ink/10 bg-mist/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-8">
        <Link href="/" className="font-serif text-xl tracking-[0.26em] text-ink">
          DUOMEI
        </Link>
        <nav className="hidden items-center gap-7 text-[11px] uppercase tracking-[0.22em] text-graphite md:flex">
          {links.map((link) => {
            const active =
              link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`transition-colors duration-700 ease-editorial hover:text-ink ${
                  active ? "text-ink" : ""
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <Link
          href="/travel"
          className="text-[11px] uppercase tracking-[0.22em] text-ink md:hidden"
        >
          Travel
        </Link>
      </div>
    </header>
  );
}
