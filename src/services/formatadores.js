// Funções de formatação compartilhadas pelas telas e serviços.

export function somenteDigitos(valor) {
  return String(valor ?? '').replace(/\D/g, '');
}

/** "47811936844" -> "478.119.368-44" */
export function formatarCpf(cpf) {
  const d = somenteDigitos(cpf);
  if (d.length !== 11) return cpf ?? '';
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** "47811936844" -> "478.***.368-44" (para listas de auditoria) */
export function mascararCpf(cpf) {
  const d = somenteDigitos(cpf);
  if (d.length !== 11) return cpf ?? '';
  return `${d.slice(0, 3)}.***.${d.slice(6, 9)}-${d.slice(9)}`;
}

function doisDigitos(n) {
  return String(n).padStart(2, '0');
}

/** Data -> "YYYY-MM-DD" no fuso do navegador. */
export function dataLocalISO(data) {
  return `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}`;
}

/**
 * Instante ISO em UTC ("2026-11-13T00:52:58.377Z") -> "2026-11-12T21:52:58" no fuso do navegador.
 * As telas comparam/fatiam esse texto (data = 0..10, hora = 11..16), então ele precisa ser local.
 */
export function dataHoraLocal(instante) {
  const d = instante instanceof Date ? instante : new Date(instante);
  return `${dataLocalISO(d)}T${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}:${doisDigitos(d.getSeconds())}`;
}

/** "YYYY-MM-DD" (campo de data) -> Date no início/fim desse dia local. */
export function inicioDoDia(dataISO) {
  const [a, m, d] = dataISO.split('-').map(Number);
  return new Date(a, m - 1, d, 0, 0, 0, 0);
}

export function fimDoDia(dataISO) {
  const [a, m, d] = dataISO.split('-').map(Number);
  return new Date(a, m - 1, d, 23, 59, 59, 999);
}
