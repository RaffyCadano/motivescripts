import { Code2, MapPin, Smartphone, Timer } from "lucide-react";
import { AnimateIn } from "@/components/AnimateIn";

const stats = [
  { icon: Timer, value: "2–4 wk", label: "Typical launch", color: "text-blue" },
  { icon: Code2, value: "100%", label: "Custom-built", color: "text-cyan" },
  { icon: Smartphone, value: "100%", label: "Mobile-friendly", color: "text-bright" },
];

export function TrustSection() {
  return (
    <section className="border-t border-[var(--color-line)] py-8 md:py-10">
      <div className="container-wide">
        <AnimateIn>
          <div className="mx-auto max-w-3xl rounded-2xl border border-[var(--color-line)] px-6 py-6 sm:px-10 sm:py-7">
            <div className="grid grid-cols-1 divide-y divide-[var(--color-line)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className="flex flex-col items-center gap-1.5 py-3 text-center first:pt-0 last:pb-0 sm:px-4 sm:py-0"
                  >
                    <Icon size={18} strokeWidth={2.2} className={stat.color} aria-hidden="true" />
                    <span className="font-heading text-xl font-bold tracking-tight text-ink sm:text-2xl">
                      {stat.value}
                    </span>
                    <span className="text-xs font-semibold text-muted-strong">{stat.label}</span>
                  </div>
                );
              })}
            </div>
            <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-faint">
              <MapPin size={13} strokeWidth={2.2} aria-hidden="true" />
              Based in Winston-Salem, North Carolina
            </p>
          </div>
        </AnimateIn>
      </div>
    </section>
  );
}
