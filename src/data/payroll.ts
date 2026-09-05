export type StaffPayRate = {
  userId: string;
  payRateCents: number;
  updatedAt: string;
};

export const payrollPaymentMethods = ["bank_transfer", "zelle", "paypal", "cash", "check", "other"] as const;
export type PayrollPaymentMethod = (typeof payrollPaymentMethods)[number];

export function payrollMethodLabel(method: PayrollPaymentMethod): string {
  switch (method) {
    case "bank_transfer":
      return "Bank Transfer";
    case "zelle":
      return "Zelle";
    case "paypal":
      return "PayPal";
    case "cash":
      return "Cash";
    case "check":
      return "Check";
    case "other":
      return "Other";
  }
}

export type PayrollPayment = {
  id: string;
  staffId: string;
  amountCents: number;
  hours: number;
  payRateCents: number;
  throughDate: string;
  paymentDate: string;
  method: PayrollPaymentMethod;
  reference: string;
  notes: string;
  recordedBy: string | null;
  recordedByLabel: string;
  createdAt: string;
};

export type MarkPaidResult = {
  paymentId: string;
  amountCents: number;
  hours: number;
  entries: number;
};

export function payrollErrorMessage(code: string): string {
  switch (code) {
    case "NOT_FOUND":
      return "That staff member could not be found.";
    case "INVALID_RATE":
      return "Enter a pay rate of $0 or more.";
    case "NO_PAY_RATE":
      return "Set an hourly rate for this staff member before marking hours paid.";
    case "NOTHING_TO_PAY":
      return "There are no unpaid hours through that date.";
    case "PAYMENT_INVALID":
      return "Choose a valid payment method.";
    case "not_allowed":
      return "You don’t have permission to do that.";
    case "network":
      return "We couldn’t reach the server. Check your connection and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export function payrollErrorCode(message: string): string {
  const upper = message.toUpperCase();
  if (upper.includes("NOT_FOUND")) return "NOT_FOUND";
  if (upper.includes("INVALID_RATE")) return "INVALID_RATE";
  if (upper.includes("NO_PAY_RATE")) return "NO_PAY_RATE";
  if (upper.includes("NOTHING_TO_PAY")) return "NOTHING_TO_PAY";
  if (upper.includes("PAYMENT_INVALID")) return "PAYMENT_INVALID";
  if (message.toLowerCase().includes("failed to fetch") || message.toLowerCase().includes("network")) {
    return "network";
  }
  if (message.toLowerCase().includes("row-level security") || message.includes("42501")) return "not_allowed";
  return "error";
}
