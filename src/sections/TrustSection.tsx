import { AnimateIn } from "@/components/AnimateIn";

const stats = [
  { value: "2–4 wk", label: "Typical launch" },
  { value: "100%", label: "Custom-built" },
  { value: "100%", label: "Mobile-friendly" },
];

export function TrustSection() {
  return (
    <section className="border-t border-[var(--color-line)] py-10 md:py-14">
      <div className="container-wide">
        <AnimateIn>
          <div className="flex flex-col items-center gap-6 text-center">
            <ul className="flex flex-wrap items-start justify-center gap-x-12 gap-y-6">
              {stats.map((stat) => (
                <li key={stat.label} className="flex flex-col items-center gap-1">
                  <span className="font-heading text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                    {stat.value}
                  </span>
                  <span className="text-sm font-semibold text-muted-strong">{stat.label}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-faint">Based in Winston-Salem, North Carolina</p>
          </div>
        </AnimateIn>
      </div>
    </section>
  );
}
