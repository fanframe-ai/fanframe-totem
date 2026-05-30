import { describe, expect, it } from "vitest";
import { cleanCpf, formatCpf, isValidCpf } from "./cpf";

describe("CPF helpers", () => {
  it("formats CPF while the user types", () => {
    expect(formatCpf("12345678909")).toBe("123.456.789-09");
    expect(formatCpf("123.456")).toBe("123.456");
    expect(formatCpf("abc12345678909000")).toBe("123.456.789-09");
  });

  it("validates real CPF check digits", () => {
    expect(isValidCpf("123.456.789-09")).toBe(true);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("123.456.789-00")).toBe(false);
    expect(isValidCpf("123")).toBe(false);
  });

  it("returns only CPF digits", () => {
    expect(cleanCpf("123.456.789-09")).toBe("12345678909");
  });
});
