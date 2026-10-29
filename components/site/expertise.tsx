"use client";

import { ArrowUpRight, Bot, Code2, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { services } from "@/lib/site-content";
import { ScrollReveal } from "./scroll-reveal";

const icons = [Code2, RefreshCw, Bot];
const tones = ["service-blue", "service-cyan", "service-violet"];

export function Expertise() {
  return (
    <section id="expertise" aria-labelledby="expertise-title" className="bg-white pt-16 pb-24 md:pt-20 md:pb-32">
      <ScrollReveal className="page-shell">
        <div className="mb-9 flex flex-wrap items-end justify-between gap-5">
          <h2 id="expertise-title" className="section-title max-w-[700px]">
            From ambition to working software
          </h2>
          <p className="max-w-[350px] text-base leading-relaxed text-[#3d506a]">
            Choose the challenge in front of you. We focus the right engineering
            work around it.
          </p>
        </div>

        <Tabs defaultValue="engineering" className="gap-5">
          <TabsList
            aria-label="Explore our expertise"
            className="grid h-auto w-full grid-cols-1 gap-3 bg-transparent p-0 group-data-horizontal/tabs:h-auto md:grid-cols-3"
          >
            {services.map((service, index) => {
              const Icon = icons[index];
              return (
                <TabsTrigger
                  key={service.id}
                  value={service.id}
                  className="h-auto min-w-0 rounded-2xl p-0 text-left data-active:bg-transparent data-active:shadow-none"
                >
                  <Card className={`service-card ${tones[index]} h-full w-full border-0 py-0 shadow-none`}>
                    <CardContent className="flex h-full min-h-[208px] flex-col items-start gap-6 p-6">
                      <span className="service-icon" aria-hidden="true">
                        <Icon className="size-6" strokeWidth={1.8} />
                      </span>
                      <span className="mt-auto block">
                        <span className="mb-2 flex items-center justify-between gap-2 text-lg font-bold text-[#101d35]">
                          {service.title}
                          <ArrowUpRight className="size-5 shrink-0" aria-hidden="true" />
                        </span>
                        <span className="block whitespace-normal text-[0.95rem] font-normal leading-relaxed text-[#3d506a]">
                          {service.summary}
                        </span>
                      </span>
                    </CardContent>
                  </Card>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {services.map((service) => (
            <TabsContent
              key={service.id}
              value={service.id}
              className="service-detail rounded-2xl bg-[#f3f7fb] px-6 py-7 md:px-9 md:py-8"
            >
              <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(240px,0.8fr)] md:items-end">
                <p className="max-w-[640px] text-lg leading-relaxed text-[#101d35] md:text-xl">
                  {service.detail}
                </p>
                <ul className="grid gap-2 text-sm font-semibold text-[#3d506a] sm:grid-cols-3 md:grid-cols-1">
                  {service.points.map((point) => (
                    <li key={point} className="flex items-center gap-3">
                      <span className="size-1.5 rounded-full bg-[#0b39d1]" aria-hidden="true" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </ScrollReveal>
    </section>
  );
}
