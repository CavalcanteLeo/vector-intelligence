import Image from "next/image";
import Link from "next/link";
import { ContactButton } from "./contact-button";

const links = [
  { href: "#expertise", label: "Expertise" },
  { href: "#approach", label: "Approach" },
  { href: "#about", label: "About" },
];

export function SiteHeader() {
  return (
    <header className="site-header relative z-20 mx-auto flex w-full max-w-[1600px] items-center justify-between gap-6 px-5 py-5 sm:px-8 lg:px-14">
      <Link href="/" aria-label="Vector Intelligence home" className="shrink-0">
        <Image
          src="/assets/images/vector-intelligence-logo.svg"
          alt="Vector Intelligence"
          width={264}
          height={48}
          priority
          className="h-auto w-[184px] sm:w-[225px]"
        />
      </Link>

      <nav aria-label="Main navigation" className="hidden items-center gap-8 lg:flex">
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="text-sm font-semibold text-[#101d35] underline-offset-4 transition-colors hover:text-[#0b39d1] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0b39d1]"
          >
            {link.label}
          </a>
        ))}
      </nav>

      <div className="hidden sm:block">
        <ContactButton className="h-11 rounded-xl bg-[#0b39d1] px-5 text-white hover:bg-[#082eaa]" />
      </div>
    </header>
  );
}
