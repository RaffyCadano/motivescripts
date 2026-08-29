const base =
  "inline-flex h-10 items-center rounded-[var(--admin-radius)] px-4 font-heading text-sm font-semibold transition-colors disabled:opacity-60";

export const adminPrimaryBtn = `${base} bg-[var(--admin-navy)] text-white hover:bg-[#001a4d]`;

export const adminBlueBtn = `${base} bg-[var(--admin-blue)] text-white hover:bg-[var(--admin-bright)]`;

export const adminSoftBtn = `${base} border border-[rgb(0_80_240_/_0.22)] bg-[rgb(0_80_240_/_0.08)] text-[var(--admin-blue)] hover:bg-[rgb(0_80_240_/_0.14)]`;

export const adminGhostBtn = `${base} border border-[var(--admin-line)] bg-white text-[var(--admin-ink)] hover:bg-[var(--admin-hover)]`;

export const adminDangerBtn = `${base} border border-[rgb(180_35_24_/_0.28)] bg-[rgb(220_38_38_/_0.07)] text-[#b42318] hover:bg-[rgb(220_38_38_/_0.12)]`;

export const adminDangerSolidBtn = `${base} bg-[#b42318] text-white hover:bg-[#912018]`;
