import Image from "next/image";

export function SiteFooter() {
  return (
    <footer className="bg-[#071f4b] px-5 py-10 text-white sm:px-8 lg:px-14">
      <div className="mx-auto flex max-w-[1500px] flex-col items-start justify-between gap-8 sm:flex-row sm:items-end">
        <div className="flex items-center gap-3">
          <Image
            src="/assets/images/vector-intelligence-favicon.svg"
            alt=""
            width={44}
            height={44}
            className="size-11"
          />
          <span className="text-lg font-bold tracking-tight">Vector Intelligence</span>
        </div>
        <p className="text-sm text-[#c8dcf7]">
          Software engineering, modernization, and practical AI.
        </p>
      </div>
    </footer>
  );
}
