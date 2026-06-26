import Link from "next/link";
import { EditorialImage } from "@/components/EditorialImage";
import { PageTransition } from "@/components/PageTransition";
import { TravelCard } from "@/components/TravelCard";
import { travels } from "@/data/travels";

export default function Home() {
  return (
    <PageTransition>
      <section className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-12 px-5 py-16 md:grid-cols-[1fr_0.82fr] md:px-8 md:py-24">
        <div>
          <p className="mb-7 text-[11px] uppercase tracking-[0.36em] text-graphite">
            Travel Photography
          </p>
          <h1 className="font-serif text-[18vw] font-light leading-[0.82] tracking-normal text-ink md:text-[10rem]">
            DUOMEI
          </h1>
          <p className="mt-8 text-sm uppercase tracking-[0.28em] text-graphite md:text-base">
            Traveler. Photographer. Explorer.
          </p>
          <p className="mt-10 max-w-xl text-base font-light leading-8 text-graphite md:text-lg">
            来自中国桂林，现在生活在日本大阪。喜欢旅行、摄影、游戏，也喜欢记录日本生活。
          </p>
          <div className="mt-12 flex flex-wrap gap-4">
            {travels.map((travel) => (
              <Link
                key={travel.slug}
                href={`/travel/${travel.slug}`}
                className="border-b border-ink/40 pb-2 text-sm uppercase tracking-[0.22em] text-ink transition duration-700 ease-editorial hover:border-ink/0 hover:text-graphite"
              >
                {travel.title}
              </Link>
            ))}
          </div>
        </div>
        <EditorialImage
          background="linear-gradient(135deg, #111111, #77736b, #f0ece4)"
          label="Minimal travel photography cover"
          className="aspect-[4/5] w-full"
        />
      </section>

      <section className="border-t border-ink/10 px-5 py-24 md:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <h2 className="font-serif text-5xl font-light text-ink md:text-7xl">
              Selected Places
            </h2>
            <Link
              href="/travel"
              className="text-xs uppercase tracking-[0.28em] text-graphite transition hover:text-ink"
            >
              View all journeys
            </Link>
          </div>
          <div className="grid gap-10 md:grid-cols-3">
            {travels.slice(0, 3).map((travel, index) => (
              <TravelCard key={travel.slug} travel={travel} index={index} />
            ))}
          </div>
        </div>
      </section>
    </PageTransition>
  );
}
