import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

type Common = {
  children: ReactNode;
  className?: string;
  variant?: Variant;
  size?: Size;
};

type ButtonAsButton = Common &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    to?: undefined;
  };

type ButtonAsLink = Common & {
  to: string;
  type?: never;
  disabled?: boolean;
};

export type ButtonProps = ButtonAsButton | ButtonAsLink;

const variants: Record<Variant, string> = {
  primary:
    "border-transparent bg-[linear-gradient(135deg,#0050F0_0%,#0060FF_58%,#1aa8ff_140%)] text-white shadow-[var(--shadow-button)] hover:brightness-110 hover:shadow-[0_10px_28px_rgb(0_200_255_/_0.18)]",
  secondary:
    "border-[var(--color-line-strong)] bg-white text-ink hover:border-[rgb(0_80_240_/_0.45)] hover:bg-[rgb(0_80_240_/_0.04)]",
  ghost: "border-transparent bg-transparent text-muted hover:text-ink",
};

const sizes: Record<Size, string> = {
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-[0.95rem] md:h-[3.25rem] md:px-7",
};

function buttonClass(variant: Variant, size: Size, className?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] border font-heading font-semibold tracking-tight transition-[filter,background-color,border-color,box-shadow,color,transform] duration-[var(--duration-base)] ease-[var(--ease-out)]",
    "active:translate-y-px",
    "disabled:pointer-events-none disabled:opacity-60",
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button(props: ButtonProps) {
  if ("to" in props && props.to) {
    const { children, className, variant = "primary", size = "md", to } = props;
    return (
      <Link to={to} className={buttonClass(variant, size, className)}>
        {children}
      </Link>
    );
  }

  const { children, className, variant = "primary", size = "md", type = "button", to: _to, ...rest } =
    props as ButtonAsButton;

  return (
    <button type={type} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </button>
  );
}
