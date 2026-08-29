import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

export type AdminActionsMenuItem = {
  id: string;
  label: string;
  icon?: LucideIcon;
  onSelect?: () => void;
  href?: string;
  disabled?: boolean;
  danger?: boolean;
  separatorBefore?: boolean;
};

export function AdminActionsMenu({
  label = "Actions",
  ariaLabel,
  disabled,
  items,
}: {
  label?: string;
  ariaLabel?: string;
  disabled?: boolean;
  items: AdminActionsMenuItem[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const visible = items.filter((item) => item.label);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (visible.length === 0) return null;

  const itemClass = (item: AdminActionsMenuItem) =>
    [
      "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px]",
      item.danger ? "text-[#b42318] hover:bg-[rgb(220_38_38_/_0.08)]" : "text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]",
      item.disabled ? "cursor-not-allowed opacity-50 hover:bg-transparent" : "",
    ].join(" ");

  function itemContent(item: AdminActionsMenuItem): ReactNode {
    const Icon = item.icon;
    return (
      <>
        {Icon ? <Icon size={15} strokeWidth={1.75} className="shrink-0" aria-hidden="true" /> : null}
        {item.label}
      </>
    );
  }

  function closeAndRun(item: AdminActionsMenuItem) {
    if (item.disabled) return;
    setOpen(false);
    item.onSelect?.();
  }

  function isExternalHref(href: string) {
    return /^(mailto:|tel:|https?:)/i.test(href);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="inline-flex h-10 items-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-4 font-heading text-sm font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)] disabled:opacity-60"
        aria-label={ariaLabel ?? label}
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
        <ChevronDown size={16} strokeWidth={1.75} className="ml-2" aria-hidden="true" />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded-xl border border-[var(--admin-line)] bg-white py-1 shadow-[0_12px_32px_rgb(7_17_31_/_0.08)]"
        >
          {visible.map((item) => (
            <div key={item.id}>
              {item.separatorBefore ? <div className="my-1 border-t border-[var(--admin-line)]" /> : null}
              {item.href && !item.disabled && isExternalHref(item.href) ? (
                <a
                  href={item.href}
                  role="menuitem"
                  className={itemClass(item)}
                  onClick={() => setOpen(false)}
                >
                  {itemContent(item)}
                </a>
              ) : item.href && !item.disabled ? (
                <Link
                  to={item.href}
                  role="menuitem"
                  className={itemClass(item)}
                  onClick={() => setOpen(false)}
                >
                  {itemContent(item)}
                </Link>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  className={itemClass(item)}
                  onClick={() => closeAndRun(item)}
                >
                  {itemContent(item)}
                </button>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
