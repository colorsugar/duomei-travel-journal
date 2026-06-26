import { PageTransition } from "@/components/PageTransition";
import { SectionIntro } from "@/components/SectionIntro";
import { journalPosts } from "@/data/journal";

export default function JournalPage() {
  return (
    <PageTransition>
      <section className="px-5 py-20 md:px-8 md:py-28">
        <SectionIntro
          eyebrow="Journal"
          title="Field Notes"
          body="以后可以写日本生活、旅行记录、摄影心得。文章列表保持安静、清晰，像一本慢慢更新的杂志目录。"
        />
      </section>
      <section className="mx-auto max-w-5xl px-5 pb-28 md:px-8">
        <div className="divide-y divide-ink/10 border-y border-ink/10">
          {journalPosts.map((post) => (
            <article
              key={post.title}
              className="grid gap-5 py-10 md:grid-cols-[0.25fr_1fr]"
            >
              <time className="text-xs uppercase tracking-[0.24em] text-graphite">
                {post.date}
              </time>
              <div>
                <h2 className="font-serif text-4xl font-light text-ink">
                  {post.title}
                </h2>
                <p className="mt-5 max-w-2xl text-base font-light leading-8 text-graphite">
                  {post.excerpt}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </PageTransition>
  );
}
