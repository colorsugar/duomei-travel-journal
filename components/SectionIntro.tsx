type SectionIntroProps = {
  eyebrow?: string;
  title: string;
  body?: string;
};

export function SectionIntro({ eyebrow, title, body }: SectionIntroProps) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      {eyebrow ? (
        <p className="mb-5 text-[11px] uppercase tracking-[0.32em] text-graphite">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="font-serif text-5xl font-light leading-none text-ink md:text-7xl">
        {title}
      </h1>
      {body ? (
        <p className="mx-auto mt-8 max-w-2xl text-base font-light leading-8 text-graphite md:text-lg">
          {body}
        </p>
      ) : null}
    </div>
  );
}
