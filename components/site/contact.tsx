import { ContactButton } from "./contact-button";
import { ScrollReveal } from "./scroll-reveal";

export function Contact() {
  return (
    <section id="contact" aria-labelledby="contact-title" className="section-pad bg-[#0b39d1] text-white">
      <ScrollReveal className="page-shell flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
        <div>
          <h2 id="contact-title" className="section-title max-w-[680px] text-white">
            Tell us what needs to change
          </h2>
          <p className="mt-5 max-w-[580px] text-lg leading-relaxed text-[#e4efff]">
            Share what you have today and where you want to go. We can start
            with a focused conversation about the next useful step.
          </p>
        </div>
        <ContactButton className="h-12 rounded-xl bg-white px-6 font-bold text-[#0b39d1] hover:bg-[#e4efff]" />
      </ScrollReveal>
    </section>
  );
}
