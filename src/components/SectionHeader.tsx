import { cn } from "@/lib/cn";

type SectionHeaderProps = {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
};

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "left",
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn(align === "center" && "mx-auto max-w-2xl text-center", className)}>
      <p className={cn("eyebrow", align === "center" && "justify-center before:hidden")}>{eyebrow}</p>
      <h2 className="mt-4 text-[1.85rem] md:text-[2.6rem] lg:text-[2.85rem]">{title}</h2>
      {description ? (
        <p className={cn("mt-4 max-w-xl text-[var(--text-md)] text-muted", align === "center" && "mx-auto")}>
          {description}
        </p>
      ) : null}
    </div>
  );
}
