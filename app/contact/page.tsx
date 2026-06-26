import { Instagram, Mail } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { SectionIntro } from "@/components/SectionIntro";

const contacts = [
  { label: "Instagram", value: "@duomei.photo", icon: Instagram },
  { label: "X", value: "@duomei", icon: null },
  { label: "Email", value: "hello@example.com", icon: Mail }
];

export default function ContactPage() {
  return (
    <PageTransition>
      <section className="px-5 py-20 md:px-8 md:py-28">
        <SectionIntro
          eyebrow="Contact"
          title="Say Hello"
          body="这里先放社交媒体和邮箱占位，之后可以替换成多美自己的联系方式。"
        />
      </section>
      <section className="mx-auto max-w-4xl px-5 pb-28 md:px-8">
        <div className="divide-y divide-ink/10 border-y border-ink/10">
          {contacts.map((contact) => {
            const Icon = contact.icon;
            return (
              <div
                key={contact.label}
                className="flex items-center justify-between gap-6 py-8"
              >
                <div className="flex items-center gap-4">
                  <span className="grid h-10 w-10 place-items-center border border-ink/15 text-ink">
                    {Icon ? (
                      <Icon size={17} strokeWidth={1.5} />
                    ) : (
                      <span className="text-sm">X</span>
                    )}
                  </span>
                  <span className="text-xs uppercase tracking-[0.26em] text-graphite">
                    {contact.label}
                  </span>
                </div>
                <span className="text-right font-serif text-2xl font-light text-ink md:text-4xl">
                  {contact.value}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </PageTransition>
  );
}
