import { EditorialImage } from "@/components/EditorialImage";
import { PageTransition } from "@/components/PageTransition";
import { SectionIntro } from "@/components/SectionIntro";

export default function AboutPage() {
  return (
    <PageTransition>
      <section className="px-5 py-20 md:px-8 md:py-28">
        <SectionIntro
          eyebrow="About"
          title="多美"
          body="从桂林到大阪，在护理工作、旅行和摄影之间，收集生活中安静却有力量的片刻。"
        />
      </section>
      <section className="mx-auto grid max-w-6xl gap-12 px-5 pb-28 md:grid-cols-[0.8fr_1fr] md:px-8">
        <EditorialImage
          background="linear-gradient(135deg, #111111, #68645d, #e8e2d7)"
          label="Portrait placeholder"
          className="aspect-[4/5] w-full"
        />
        <div className="self-center">
          <p className="text-[11px] uppercase tracking-[0.32em] text-graphite">
            Guilin / Osaka
          </p>
          <div className="mt-8 space-y-7 text-base font-light leading-8 text-graphite md:text-lg">
            <p>
              多美出生在中国桂林，现在生活在日本大阪。从故乡的山水到大阪的街道，镜头一直是她理解世界的方式。
            </p>
            <p>
              现在从事介护工作，也在工作之外持续旅行、拍照、记录日本生活。她喜欢慢慢观察一个地方的光线、天气和人的移动，让照片保留真实的距离感。
            </p>
            <p>
              这个网站会用来整理旅行地点、摄影主题、生活文字和未来的个人作品。
            </p>
          </div>
        </div>
      </section>
    </PageTransition>
  );
}
