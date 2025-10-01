const NAME_RE = /^[a-z0-9]([-a-z0-9\.]*[a-z0-9])?$/i;

export function vName(v?: string, label = 'name') {
  if (!v) return;
  if (!NAME_RE.test(v)) throw new Error(`${label} inválido: ${v}`);
}