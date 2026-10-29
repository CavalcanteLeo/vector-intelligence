import { ArrowRight } from "lucide-react";
import { ScrollReveal } from "./scroll-reveal";

const steps = [
  {
    title: "Map the system you have",
    description:
      "Start with the product, the people who use it, and the technical constraints that shape the work.",
  },
  {
    title: "Prioritize the changes",
    description:
      "Find the smallest useful path forward, whether that means building new software or evolving what already exists.",
  },
  {
    title: "Build and evaluate in context",
    description:
      "Build with the people who will use it, then test whether it improves the real workflow.",
  },
];

export function Approach() {
  return (
    <section id="approach" aria-labelledby="approach-title" className="section-pad bg-[#071f4b] text-white">
      <ScrollReveal className="page-shell">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <div>
            <h2 id="approach-title" className="section-title max-w-[500px] text-white">
              Start with the system you have
            </h2>
            <p className="mt-6 max-w-[475px] text-lg leading-relaxed text-[#c8dcf7]">
              We learn how your software and teams work today, decide what
              matters most, and deliver changes you can use and maintain.
            </p>
          </div>
          <div className="space-y-10">
            {steps.map((step) => (
              <div key={step.title} className="group flex gap-5 lg:gap-8">
                <ArrowRight className="mt-1 size-5 shrink-0 text-[#51b8ff] transition-transform group-hover:translate-x-1" aria-hidden="true" />
                <div>
                  <h3 className="text-xl font-bold tracking-tight md:text-2xl">
                    {step.title}
                  </h3>
                  <p className="mt-3 max-w-[540px] leading-relaxed text-[#c8dcf7]">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}
