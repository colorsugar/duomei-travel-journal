"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { EditorialImage } from "@/components/EditorialImage";
import { PageTransition } from "@/components/PageTransition";
import { SectionIntro } from "@/components/SectionIntro";
import { photoCategories } from "@/data/photography";

export default function PhotographyPage() {
  const [active, setActive] = useState<string | null>(null);

  return (
    <PageTransition>
      <section className="px-5 py-20 md:px-8 md:py-28">
        <SectionIntro
          eyebrow="Photography"
          title="Image Archive"
          body="按主题整理风景、城市、夜景、船只和飞机。现在使用占位画面，之后可以直接替换成真实照片。"
        />
      </section>
      <section className="mx-auto max-w-7xl px-5 pb-28 md:px-8">
        <div className="space-y-20">
          {photoCategories.map((category) => (
            <div key={category.name}>
              <div className="mb-8 flex items-end justify-between border-b border-ink/10 pb-5">
                <h2 className="font-serif text-4xl font-light text-ink md:text-6xl">
                  {category.name}
                </h2>
                <span className="text-xs uppercase tracking-[0.24em] text-graphite">
                  {category.images.length} works
                </span>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                {category.images.map((image, index) => (
                  <button
                    key={`${category.name}-${index}`}
                    type="button"
                    onClick={() => setActive(image)}
                    className="cursor-zoom-in"
                    aria-label={`Open ${category.name} photo ${index + 1}`}
                  >
                    <EditorialImage
                      background={image}
                      className="aspect-[16/11] w-full transition duration-[1400ms] ease-editorial hover:opacity-80"
                    />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      {active ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/90 p-5"
          onClick={() => setActive(null)}
        >
          <button
            type="button"
            className="absolute right-5 top-5 grid h-11 w-11 place-items-center border border-white/30 text-white"
            onClick={() => setActive(null)}
            aria-label="Close preview"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
          <div className="h-[78vh] w-full max-w-5xl">
            <EditorialImage background={active} className="h-full w-full" />
          </div>
        </div>
      ) : null}
    </PageTransition>
  );
}
