export function cleanCpf(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

export function formatCpf(value: string) {
  const digits = cleanCpf(value);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function isValidCpf(value: string) {
  const cpf = cleanCpf(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digits = cpf.split("").map(Number);
  const firstCheck = calculateCpfCheckDigit(digits.slice(0, 9));
  const secondCheck = calculateCpfCheckDigit([...digits.slice(0, 9), firstCheck]);

  return digits[9] === firstCheck && digits[10] === secondCheck;
}

function calculateCpfCheckDigit(numbers: number[]) {
  const factorStart = numbers.length + 1;
  const sum = numbers.reduce((total, number, index) => total + number * (factorStart - index), 0);
  const remainder = (sum * 10) % 11;
  return remainder === 10 ? 0 : remainder;
}
