import Image from "next/image";
import { ArrowDownRight } from "lucide-react";
import { ContactButton } from "./contact-button";

export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="grid min-h-[540px] overflow-hidden bg-white md:grid-cols-2"
    >
      <div className="relative z-10 flex flex-col items-start justify-center px-6 py-14 sm:px-8 md:px-10 lg:px-14 xl:px-20">
        <h1
          id="hero-title"
          className="max-w-[680px] text-[clamp(2.55rem,10vw,4.5rem)] leading-[1.04] font-extrabold tracking-[-0.04em] text-[#101d35] text-balance md:text-[clamp(2.7rem,5vw,5.4rem)]"
        >
          Software built for what comes next
        </h1>
        <p className="mt-6 max-w-[570px] text-[1.08rem] leading-[1.55] text-[#3d506a] text-pretty md:mt-8 lg:text-[1.28rem]">
          We build new software, modernize complex systems, and make AI useful
          in real work.
        </p>
        <div className="mt-9 flex flex-wrap items-start gap-3 max-[420px]:flex-col">
          <ContactButton className="h-12 rounded-xl bg-[#0b39d1] px-6 text-white hover:bg-[#082eaa]" />
          <a
            href="#expertise"
            className="inline-flex h-12 items-center gap-3 rounded-xl px-4 text-sm font-bold text-[#101d35] transition-colors hover:bg-[#edf4fc] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#0b39d1]"
          >
            Explore our expertise
            <ArrowDownRight aria-hidden="true" className="size-4" />
          </a>
        </div>
      </div>

      <div className="relative min-h-[340px] bg-[#061c45] min-[421px]:min-h-[400px] md:min-h-[540px]">
        <Image
          src="/assets/images/vector-intelligence-mascote.png"
          alt="Vector Intelligence robot mascot with a luminous blue neural network"
          fill
          priority
          sizes="(max-width: 767px) 100vw, 54vw"
          className="object-cover object-[center_36%] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-6 motion-safe:duration-700 motion-safe:ease-out md:object-[center_41%]"
        />
      </div>
    </section>
  );
}
