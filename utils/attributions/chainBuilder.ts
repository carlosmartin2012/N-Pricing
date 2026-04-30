/**
 * Ola 8 — Atribuciones jerárquicas (Bloque A).
 *
 * Construcción de la cadena de aprobación bottom-up. Dado un nivel
 * "requerido", devuelve la cadena desde la raíz hasta él (útil para UX
 * que muestra "Tu cadena: Oficina → Zona → Comité").
 *
 * Pure: no I/O.
 */

import type { AttributionLevel } from '../../types/attributions';

/**
 * Devuelve los niveles activos ordenados ascendente por `levelOrder`.
 * Si dos niveles tienen el mismo `levelOrder`, desempata por nombre
 * (estable y predecible para tests).
 */
export function sortLevelsAscending(levels: AttributionLevel[]): AttributionLevel[] {
  return [...levels]
    .filter((l) => l.active)
    .sort((a, b) => a.levelOrder - b.levelOrder || a.name.localeCompare(b.name));
}

/**
 * Encuentra la raíz del árbol: nivel con `parentId === null`. Si hay
 * varios (organigramas con multi-raíz, p.ej. dos territorios paralelos)
 * devuelve el de menor `levelOrder`.
 */
export function findRoot(levels: AttributionLevel[]): AttributionLevel | null {
  const roots = levels.filter((l) => l.active && l.parentId === null);
  if (roots.length === 0) return null;
  return [...roots].sort((a, b) => a.levelOrder - b.levelOrder)[0];
}

/**
 * Construye la cadena bottom-up desde la raíz hasta `targetLevelId`. Si
 * `targetLevelId` no existe o está inactivo, devuelve `[]`. Si hay
 * ciclos (parent_id apunta hacia abajo), corta a las primeras N
 * iteraciones para evitar loops infinitos.
 */
export function buildApprovalChain(
  targetLevelId: string,
  levels: AttributionLevel[],
): AttributionLevel[] {
  const byId = new Map(levels.filter((l) => l.active).map((l) => [l.id, l]));
  const target = byId.get(targetLevelId);
  if (!target) return [];

  // Subimos por parent_id hasta raíz, acumulando.
  const chain: AttributionLevel[] = [];
  const visited = new Set<string>();
  let current: AttributionLevel | undefined = target;
  const maxSteps = levels.length + 1;
  let steps = 0;
  while (current && steps < maxSteps) {
    if (visited.has(current.id)) break; // ciclo detectado
    visited.add(current.id);
    chain.unshift(current); // bottom-up
    if (current.parentId === null) break;
    current = byId.get(current.parentId);
    steps++;
  }
  return chain;
}

/**
 * Devuelve los hijos directos de un nivel (útil para reporting y para el
 * editor visual de la matriz).
 */
export function findChildren(
  levelId: string,
  levels: AttributionLevel[],
): AttributionLevel[] {
  return levels.filter((l) => l.active && l.parentId === levelId);
}

/**
 * Devuelve los descendientes (recursivo) de un nivel. Útil para reporting
 * tipo "todos los gestores bajo Zona Norte".
 */
export function findDescendants(
  levelId: string,
  levels: AttributionLevel[],
): AttributionLevel[] {
  const out: AttributionLevel[] = [];
  const queue = [...findChildren(levelId, levels)];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const next = queue.shift()!;
    if (seen.has(next.id)) continue; // protección contra ciclos
    seen.add(next.id);
    out.push(next);
    queue.push(...findChildren(next.id, levels));
  }
  return out;
}
