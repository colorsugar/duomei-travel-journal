import { PageTransition } from "@/components/PageTransition";
import { SectionIntro } from "@/components/SectionIntro";
import { TravelCard } from "@/components/TravelCard";
import { travels } from "@/data/travels";

export default function TravelPage() {
  return (
    <PageTransition>
      <section className="px-5 py-20 md:px-8 md:py-28">
        <SectionIntro
          eyebrow="Travel"
          title="Journeys"
          body="把城市、海岸、山水和途中遇见的安静瞬间，整理成可以慢慢翻阅的旅行档案。"
        />
      </section>
      <section className="mx-auto grid max-w-7xl gap-x-8 gap-y-16 px-5 pb-28 md:grid-cols-3 md:px-8">
        {travels.map((travel, index) => (
          <TravelCard key={travel.slug} travel={travel} index={index} />
        ))}
      </section>
    </PageTransition>
  );
}
