import { ArrowRight } from "lucide-react";

const steps = [
  {
    title: "See the whole system",
    description:
      "Start with the product, the people who use it, and the technical constraints that shape the work.",
  },
  {
    title: "Choose the right change",
    description:
      "Find the smallest useful path forward, whether that means building new software or evolving what already exists.",
  },
  {
    title: "Make it work in practice",
    description:
      "Connect engineering, AI, and operations so the result fits the real workflow, not just a demo.",
  },
];

export function Approach() {
  return (
    <section id="approach" aria-labelledby="approach-title" className="section-pad bg-[#071f4b] text-white">
      <div className="page-shell">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <div>
            <h2 id="approach-title" className="section-title max-w-[500px] text-white">
              Clarity before complexity
            </h2>
            <p className="mt-6 max-w-[475px] text-lg leading-relaxed text-[#c8dcf7]">
              The best solution starts with the problem worth solving. We look
              at the existing system and the desired outcome before choosing
              technology.
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
      </div>
    </section>
  );
}
