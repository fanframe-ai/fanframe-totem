import type { KioskPayment, KioskSession } from "./types";

export function isConfirmedPagBankPayment(payment: KioskPayment | null | undefined) {
  return payment?.provider === "pagbank_pix" && payment.status === "paid";
}

export function getConfirmedPagBankPayments(payments: KioskPayment[]) {
  return payments.filter(isConfirmedPagBankPayment);
}

export function getSessionsWithConfirmedPagBankPayment(sessions: KioskSession[], payments: KioskPayment[]) {
  const paidSessionIds = new Set(getConfirmedPagBankPayments(payments).map((payment) => payment.session_id));
  return sessions.filter((session) => paidSessionIds.has(session.id));
}
