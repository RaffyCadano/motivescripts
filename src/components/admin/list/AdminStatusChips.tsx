import { adminStatusChipClass } from "@/components/admin/list/adminListStyles";

export function AdminStatusChips<T extends string>({
  items,
  value,
  onChange,
  label,
  format,
}: {
  items: readonly T[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  format?: (item: T) => string;
}) {
  return (
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label={label}>
      {items.map((item) => (
        <button
          key={item}
          type="button"
          aria-pressed={value === item}
          className={adminStatusChipClass(value === item)}
          onClick={() => onChange(item)}
        >
          {format ? format(item) : item}
        </button>
      ))}
    </div>
  );
}
