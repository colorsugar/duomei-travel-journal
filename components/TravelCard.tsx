import Link from "next/link";
import { Travel } from "@/data/travels";
import { EditorialImage } from "./EditorialImage";

export function TravelCard({ travel, index }: { travel: Travel; index: number }) {
  return (
    <Link
      href={`/travel/${travel.slug}`}
      className="group block"
      style={{ animationDelay: `${index * 120}ms` }}
    >
      <EditorialImage
        background={travel.coverImage}
        label={travel.title}
        className="aspect-[4/5] w-full"
      />
      <div className="mt-5 flex items-start justify-between gap-6">
        <div>
          <h2 className="font-serif text-3xl font-light text-ink">{travel.title}</h2>
          <p className="mt-2 text-xs uppercase tracking-[0.22em] text-graphite">
            {travel.location}
          </p>
        </div>
        <span className="pt-2 text-xs text-graphite">{travel.date}</span>
      </div>
      <p className="mt-4 max-w-sm text-sm font-light leading-7 text-graphite">
        {travel.description}
      </p>
    </Link>
  );
}
