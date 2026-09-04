export type TimeEntry = {
  id: string;
  projectId: string;
  taskId: string | null;
  staffId: string;
  entryDate: string;
  hours: number;
  note: string;
  billedAt: string | null;
  invoiceId: string | null;
  payrollPaidAt: string | null;
  createdAt: string;
};

export type TimeEntryDraft = {
  projectId: string;
  taskId: string | null;
  hours: number;
  note: string;
  entryDate: string;
};

export function sumHours(entries: TimeEntry[]): number {
  return Math.round(entries.reduce((total, entry) => total + entry.hours, 0) * 100) / 100;
}

export function unbilledEntries(entries: TimeEntry[]): TimeEntry[] {
  return entries.filter((entry) => !entry.billedAt);
}

export function unpaidEntries(entries: TimeEntry[]): TimeEntry[] {
  return entries.filter((entry) => !entry.payrollPaidAt);
}

export function amountOwedCents(entries: TimeEntry[], payRateCents: number): number {
  return Math.round(sumHours(unpaidEntries(entries)) * payRateCents);
}
