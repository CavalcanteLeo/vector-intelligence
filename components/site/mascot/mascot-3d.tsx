"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export function Mascot3D() {
  const container = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let disposed = false;
    let stop: (() => void) | undefined;

    import("./scene").then(async ({ startMascotScene }) => {
      if (disposed || !container.current) return;
      try {
        const cleanup = await startMascotScene(container.current, () => {
          if (!disposed) setReady(true);
        });
        if (disposed) cleanup();
        else stop = cleanup;
      } catch {
        if (!disposed) setReady(false);
      }
    });

    return () => {
      disposed = true;
      stop?.();
    };
  }, []);

  return (
    <div
      ref={container}
      role="img"
      aria-label="Interactive Vector Intelligence robot with a glowing neural-network brain. Drag to turn it around."
      className="relative h-full w-full"
    >
      <Image
        src="/assets/images/vector-intelligence-mascote-cutout.png"
        alt=""
        fill
        priority
        sizes="(max-width: 767px) 100vw, 54vw"
        className={`object-contain object-bottom transition-opacity duration-500 ${ready ? "opacity-0" : "opacity-100"}`}
      />
    </div>
  );
}
