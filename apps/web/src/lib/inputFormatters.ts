/**
 * Utilidades de formateo y validación para inputs del formulario.
 * - RUT chileno: 12.345.678-9
 * - Teléfono: +56 9 3456 6578
 */

// ---------------------------------------------------------------------------
// RUT chileno
// ---------------------------------------------------------------------------

/**
 * Formatea un RUT chileno ingresado libremente.
 * Acepta solo dígitos y la letra K final.
 * Resultado: "12.345.678-9" o "12.345.678-K"
 */
export function formatRut(raw: string): string {
  // Eliminar todo excepto dígitos y K
  const clean = raw.replace(/[^0-9kK]/g, "").toUpperCase();
  if (clean.length === 0) return "";

  // El último char es el dígito verificador
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);

  if (body.length === 0) return dv;

  // Insertar puntos cada 3 dígitos desde la derecha
  const withDots = body
    .split("")
    .reverse()
    .reduce((acc, char, i) => {
      return i > 0 && i % 3 === 0 ? char + "." + acc : char + acc;
    }, "");

  return `${withDots}-${dv}`;
}

/**
 * Devuelve el RUT sin formato (solo dígitos + K) para enviar al backend.
 */
export function cleanRut(formatted: string): string {
  return formatted.replace(/[^0-9kK]/g, "").toUpperCase();
}

/**
 * Valida el dígito verificador de un RUT chileno.
 */
export function validateRut(rut: string): boolean {
  const clean = cleanRut(rut);
  if (clean.length < 2) return false;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  const num = parseInt(body, 10);
  if (isNaN(num)) return false;

  let sum = 0;
  let multiplier = 2;
  let n = num;
  while (n > 0) {
    sum += (n % 10) * multiplier;
    n = Math.floor(n / 10);
    multiplier = multiplier < 7 ? multiplier + 1 : 2;
  }
  const expected = 11 - (sum % 11);
  const expectedStr = expected === 11 ? "0" : expected === 10 ? "K" : String(expected);
  return dv === expectedStr;
}

// ---------------------------------------------------------------------------
// Teléfono chileno / internacional
// ---------------------------------------------------------------------------

/**
 * Formatea un número de teléfono chileno.
 * Entrada: cualquier combinación de dígitos / +
 * Salida: "+56 9 XXXX XXXX" para móviles chilenos
 *         "+XX XXXXXXXXX" para otros números
 */
export function formatPhone(raw: string): string {
  // Conservar el + inicial si existe, limpiar el resto
  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");

  if (digits.length === 0) return "";

  // Detectar número chileno (56 9 XXXXXXXX)
  if (digits.startsWith("569") && digits.length <= 11) {
    const local = digits.slice(3); // después del 569
    const parts: string[] = ["+56", "9"];
    if (local.length > 0) parts.push(local.slice(0, 4));
    if (local.length > 4) parts.push(local.slice(4, 8));
    return parts.join(" ");
  }

  // Número chileno sin prefijo 56 (empieza con 9)
  if (digits.startsWith("9") && digits.length <= 9) {
    const parts = ["+56", "9"];
    if (digits.length > 1) parts.push(digits.slice(1, 5));
    if (digits.length > 5) parts.push(digits.slice(5, 9));
    return parts.join(" ");
  }

  // Número internacional genérico
  if (hasPlus || digits.length > 9) {
    return "+" + digits;
  }

  return digits;
}

/**
 * Devuelve el teléfono limpio (solo dígitos, sin +) para enviar al backend.
 */
export function cleanPhone(formatted: string): string {
  return formatted.replace(/\D/g, "");
}

// ---------------------------------------------------------------------------
// Filtros de teclado
// ---------------------------------------------------------------------------

/** Permite solo letras (incluyendo acentos y ñ) y espacios */
export function onlyLetters(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const key = e.key;
  if (key.length > 1) return;
  if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]$/.test(key)) {
    e.preventDefault();
  }
}

/** Permite solo dígitos */
export function onlyDigits(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const key = e.key;
  if (key.length > 1) return;
  if (!/^\d$/.test(key)) {
    e.preventDefault();
  }
}

/** Permite dígitos y la letra K (para RUT), además de puntos y guiones */
export function onlyRutChars(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const key = e.key;
  if (key.length > 1) return;
  if (!/^[0-9kK.\-]$/.test(key)) {
    e.preventDefault();
  }
}

/** Permite dígitos, el signo + y espacios (para teléfono) */
export function onlyPhoneChars(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const key = e.key;
  if (key.length > 1) return;
  if (!/^[0-9+\s]$/.test(key)) {
    e.preventDefault();
  }
}
