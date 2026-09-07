import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, MoreHorizontal, type LucideIcon } from "lucide-react";
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
  iconOnly = false,
}: {
  label?: string;
  ariaLabel?: string;
  disabled?: boolean;
  items: AdminActionsMenuItem[];
  iconOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const visible = items.filter((item) => item.label);

  // Rendered through a portal into <body> with fixed positioning (rather than absolute inside
  // this component's own DOM position) so an ancestor with `overflow-x-auto` -- e.g. a wide
  // table -- never clips the menu or gets forced into a horizontal scroll to "fit" it.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    // Close rather than reposition on scroll/resize -- simpler and avoids the menu drifting
    // away from the trigger while open.
    const onScrollOrResize = () => setOpen(false);
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  if (visible.length === 0) return null;

  const itemClass = (item: AdminActionsMenuItem) =>
    [
      "flex w-full items-center gap-2 px-3 py-2 text-left text-[13px]",
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
    <>
      <button
        ref={triggerRef}
        type="button"
        className={
          iconOnly
            ? "inline-flex h-10 w-10 items-center justify-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white text-[var(--admin-ink)] hover:bg-[var(--admin-bg)] disabled:opacity-60"
            : "inline-flex h-10 items-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-4 font-heading text-sm font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)] disabled:opacity-60"
        }
        aria-label={ariaLabel ?? label}
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        {iconOnly ? (
          <MoreHorizontal size={18} strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <>
            {label}
            <ChevronDown size={16} strokeWidth={1.75} className="ml-2" aria-hidden="true" />
          </>
        )}
      </button>
      {open && position
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              style={{ top: position.top, right: position.right }}
              className="admin-theme fixed z-[70] w-56 overflow-hidden rounded-lg border border-[var(--admin-line)] bg-[var(--admin-card)] py-1 shadow-[0_12px_32px_rgb(7_17_31_/_0.08)]"
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
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
