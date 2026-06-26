import { notFound } from "next/navigation";
import { EditorialImage } from "@/components/EditorialImage";
import { Gallery } from "@/components/Gallery";
import { PageTransition } from "@/components/PageTransition";
import { getTravelBySlug, travels } from "@/data/travels";

type TravelDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return travels.map((travel) => ({ slug: travel.slug }));
}

export async function generateMetadata({ params }: TravelDetailPageProps) {
  const { slug } = await params;
  const travel = getTravelBySlug(slug);

  return {
    title: travel ? `${travel.title} | DUOMEI` : "Travel | DUOMEI"
  };
}

export default async function TravelDetailPage({ params }: TravelDetailPageProps) {
  const { slug } = await params;
  const travel = getTravelBySlug(slug);

  if (!travel) {
    notFound();
  }

  return (
    <PageTransition>
      <section className="px-5 pb-16 pt-10 md:px-8 md:pb-24 md:pt-16">
        <div className="mx-auto max-w-7xl">
          <EditorialImage
            background={travel.coverImage}
            label={travel.title}
            className="aspect-[16/10] w-full md:aspect-[16/8]"
          />
          <div className="mt-12 grid gap-8 md:grid-cols-[0.72fr_1fr]">
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-graphite">
                {travel.location}
              </p>
              <h1 className="mt-5 font-serif text-6xl font-light text-ink md:text-8xl">
                {travel.title}
              </h1>
              <p className="mt-5 text-sm text-graphite">{travel.date}</p>
            </div>
            <p className="max-w-2xl self-end text-lg font-light leading-9 text-graphite">
              {travel.description}
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-24">
        <h2 className="mb-10 font-serif text-5xl font-light text-ink">Gallery</h2>
        <Gallery images={travel.images} title={travel.title} />
      </section>

      <section className="mx-auto grid max-w-6xl gap-14 px-5 py-16 md:grid-cols-[0.65fr_1fr] md:px-8 md:py-24">
        <h2 className="font-serif text-5xl font-light text-ink">Notes</h2>
        <div className="space-y-7 text-base font-light leading-8 text-graphite md:text-lg">
          {travel.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </section>

      <section className="border-t border-ink/10 px-5 py-16 md:px-8 md:py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-serif text-5xl font-light text-ink">Tips</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {travel.tips.map((tip) => (
              <div key={tip} className="border-t border-ink/20 pt-5 text-graphite">
                {tip}
              </div>
            ))}
          </div>
        </div>
      </section>
    </PageTransition>
  );
}
