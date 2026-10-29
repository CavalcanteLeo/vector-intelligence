import { About } from "@/components/site/about";
import { Approach } from "@/components/site/approach";
import { Contact } from "@/components/site/contact";
import { Expertise } from "@/components/site/expertise";
import { Hero } from "@/components/site/hero";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <Expertise />
        <Approach />
        <About />
        <Contact />
      </main>
      <SiteFooter />
    </>
  );
}
