import Image from "next/image";
import { ScrollReveal } from "./scroll-reveal";

export function About() {
  return (
    <section id="about" aria-labelledby="about-title" className="section-pad bg-[#f4f8fc]">
      <ScrollReveal className="page-shell grid items-center gap-10 md:grid-cols-[180px_1fr] lg:grid-cols-[240px_1fr] lg:gap-20">
        <div className="flex aspect-square items-center justify-center rounded-[28px] bg-white p-6">
          <Image
            src="/assets/images/vector-intelligence-favicon.svg"
            alt=""
            width={180}
            height={180}
            className="h-full w-full"
          />
        </div>
        <div>
          <h2 id="about-title" className="section-title max-w-[690px]">
            Engineering that stays useful
          </h2>
          <p className="mt-6 max-w-[720px] text-lg leading-relaxed text-[#3d506a]">
            We connect product thinking with hands-on engineering. That means
            understanding the people and systems behind each challenge, then
            building software your team can run, improve, and trust.
          </p>
        </div>
      </ScrollReveal>
    </section>
  );
}
