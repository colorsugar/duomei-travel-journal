"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { EditorialImage } from "./EditorialImage";

type GalleryProps = {
  images: string[];
  title: string;
};

export function Gallery({ images, title }: GalleryProps) {
  const [active, setActive] = useState<string | null>(null);

  return (
    <>
      <div className="grid gap-5 md:grid-cols-3">
        {images.map((image, index) => (
          <button
            key={`${image}-${index}`}
            type="button"
            onClick={() => setActive(image)}
            className="cursor-zoom-in text-left"
            aria-label={`Open ${title} image ${index + 1}`}
          >
            <EditorialImage
              background={image}
              className="aspect-[4/5] w-full transition duration-[1400ms] ease-editorial hover:opacity-80"
            />
          </button>
        ))}
      </div>
      {active ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/90 p-5"
          onClick={() => setActive(null)}
        >
          <button
            type="button"
            className="absolute right-5 top-5 grid h-11 w-11 place-items-center border border-white/30 text-white"
            onClick={() => setActive(null)}
            aria-label="Close image preview"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
          <div
            className="h-[78vh] w-full max-w-5xl"
            onClick={(event) => event.stopPropagation()}
          >
            <EditorialImage background={active} className="h-full w-full" />
          </div>
        </div>
      ) : null}
    </>
  );
}
