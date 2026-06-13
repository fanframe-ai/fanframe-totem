import { describe, expect, it } from "vitest";
import type { KioskPayment, KioskSession } from "./types";
import {
  getConfirmedPagBankPayments,
  getSessionsWithConfirmedPagBankPayment,
  isConfirmedPagBankPayment,
} from "./salesMetrics";

function payment(overrides: Partial<KioskPayment>): KioskPayment {
  return {
    id: "payment-1",
    session_id: "session-1",
    team_id: "team-1",
    device_id: "device-1",
    provider: "pagbank_pix",
    method: "pix",
    status: "pending",
    amount_cents: 2500,
    currency: "BRL",
    reference_id: "reference-1",
    pagbank_order_id: "order-1",
    expires_at: null,
    created_at: "2026-06-13T12:00:00.000Z",
    paid_at: null,
    ...overrides,
  };
}

function session(id: string): KioskSession {
  return {
    id,
    team_id: "team-1",
    device_id: "device-1",
    payment_id: null,
    generation_queue_id: null,
    status: "paid",
    selected_shirt_id: null,
    selected_background_id: null,
    amount_cents: 2500,
    currency: "BRL",
    result_image_url: null,
    error_message: null,
    created_at: "2026-06-13T12:00:00.000Z",
    completed_at: null,
  };
}

describe("sales metrics", () => {
  it("counts only PagBank PIX confirmed as a real sale", () => {
    expect(isConfirmedPagBankPayment(payment({ status: "paid", provider: "pagbank_pix", paid_at: "2026-06-13T12:01:00.000Z" }))).toBe(true);
    expect(isConfirmedPagBankPayment(payment({ status: "paid", provider: "simulated", paid_at: "2026-06-13T12:01:00.000Z" }))).toBe(false);
    expect(isConfirmedPagBankPayment(payment({ status: "pending", provider: "pagbank_pix" }))).toBe(false);
  });

  it("excludes simulated payments from revenue inputs", () => {
    const payments = [
      payment({ id: "real", status: "paid", provider: "pagbank_pix", paid_at: "2026-06-13T12:01:00.000Z" }),
      payment({ id: "test", status: "paid", provider: "simulated", paid_at: "2026-06-13T12:01:00.000Z" }),
    ];

    expect(getConfirmedPagBankPayments(payments).map((item) => item.id)).toEqual(["real"]);
  });

  it("does not mark a simulated paid session as a sale", () => {
    const sessions = [session("real-session"), session("test-session")];
    const payments = [
      payment({ id: "real", session_id: "real-session", status: "paid", provider: "pagbank_pix", paid_at: "2026-06-13T12:01:00.000Z" }),
      payment({ id: "test", session_id: "test-session", status: "paid", provider: "simulated", paid_at: "2026-06-13T12:01:00.000Z" }),
    ];

    expect(getSessionsWithConfirmedPagBankPayment(sessions, payments).map((item) => item.id)).toEqual(["real-session"]);
  });
});
