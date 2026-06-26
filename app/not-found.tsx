import Link from "next/link";

export default function NotFound() {
  return (
    <section className="grid min-h-[70vh] place-items-center px-5 text-center">
      <div>
        <p className="text-[11px] uppercase tracking-[0.32em] text-graphite">
          Not Found
        </p>
        <h1 className="mt-5 font-serif text-6xl font-light text-ink">404</h1>
        <Link
          href="/travel"
          className="mt-8 inline-block border-b border-ink/40 pb-2 text-xs uppercase tracking-[0.24em] text-ink"
        >
          Back to travel
        </Link>
      </div>
    </section>
  );
}
