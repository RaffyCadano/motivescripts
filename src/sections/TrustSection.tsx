import { AnimateIn } from "@/components/AnimateIn";

const stats = [
  { value: "2–4 wk", label: "Typical launch" },
  { value: "100%", label: "Custom-built" },
  { value: "100%", label: "Mobile-friendly" },
];

export function TrustSection() {
  return (
    <section className="border-t border-[var(--color-line)] py-6 md:py-8">
      <div className="container-wide">
        <AnimateIn>
          <div className="flex flex-col items-center gap-3 text-center">
            <ul className="flex flex-wrap items-start justify-center gap-x-8 gap-y-3">
              {stats.map((stat) => (
                <li key={stat.label} className="flex flex-col items-center gap-0.5">
                  <span className="font-heading text-lg font-bold tracking-tight text-ink sm:text-xl">
                    {stat.value}
                  </span>
                  <span className="text-xs font-semibold text-muted-strong">{stat.label}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-faint">Based in Winston-Salem, North Carolina</p>
          </div>
        </AnimateIn>
      </div>
    </section>
  );
}
