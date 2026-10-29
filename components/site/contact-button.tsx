"use client";

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type ContactButtonProps = {
  className?: string;
  label?: string;
};

export function ContactButton({
  className,
  label = "Start a conversation",
}: ContactButtonProps) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function openEmail() {
    setState("loading");

    try {
      const response = await fetch("/api/contact", { method: "POST" });
      if (!response.ok) throw new Error("Contact link unavailable");

      const data: { href: string } = await response.json();
      window.location.href = data.href;
      setState("idle");
    } catch {
      setState("error");
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-2">
      <Button
        type="button"
        size="lg"
        className={className}
        onClick={openEmail}
        disabled={state === "loading"}
      >
        {state === "loading" ? "Opening email…" : label}
        <ArrowUpRight aria-hidden="true" className="ml-2 size-4" />
      </Button>
      {state === "error" && (
        <span role="alert" className="text-sm text-red-700">
          Email could not open. Please try again.
        </span>
      )}
    </span>
  );
}
