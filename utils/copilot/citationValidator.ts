import type { CopilotCitation } from '../../types/copilot';

/**
 * Citation validator — Ola 7 Bloque C.2.
 *
 * Pure regex-driven allowlist for regulatory references. Accepts
 * canonical patterns (EBA GL, CRR3 Art., Anejo IX, SR 11-7, IFRS 9,
 * BCBS) and rejects everything else. Defensive net behind the system
 * prompt instruction "cite regulatory sources by exact reference".
 *
 * Tested in __tests__/copilotCitationValidator.test.ts. No I/O.
 */

// Each pattern matches a canonical reference shape. Order matters:
// longer / more specific patterns first so they win on overlap.
const PATTERNS: Array<{ regex: RegExp; tag: string }> = [
  { regex: /EBA\s+GL\s+\d{4}\/\d{2}(?:\s*§\s*[A-Za-z0-9.]+)?/g, tag: 'EBA' },
  { regex: /CRR3?\s+(?:Art\.|Article|Artículo)\s*\d+[a-z]?(?:\(\d+\))?/g, tag: 'CRR' },
  { regex: /Anejo\s+IX(?:\s*§\s*\d+(?:\.\d+)*)?/g, tag: 'Anejo IX' },
  { regex: /SR\s+11-7/g, tag: 'SR 11-7' },
  { regex: /IFRS\s+9(?:\s+§\s*\d+(?:\.\d+)*)?/g, tag: 'IFRS 9' },
  { regex: /BCBS\s+\d{2,3}/g, tag: 'BCBS' },
];

/**
 * Extracts validated citations from a free-form response using
 * String.prototype.matchAll. Dedupes by canonical label, preserves
 * first-seen order.
 */
export function extractValidatedCitations(text: string): CopilotCitation[] {
  if (!text) return [];
  const seen = new Map<string, CopilotCitation>();
  for (const { regex } of PATTERNS) {
    for (const match of text.matchAll(regex)) {
      const label = normalizeLabel(match[0]);
      if (!seen.has(label)) {
        seen.set(label, { label });
      }
    }
  }
  return Array.from(seen.values());
}

/**
 * Output extendido: separa citations validadas de las "candidato
 * inventado" (texto que parecía citation pero no matchea ninguna pattern
 * canónica). Uso recomendado en el handler `/api/copilot/ask` para
 * surface al usuario un banner "El modelo citó N referencias no
 * verificadas" — el riesgo regulatorio de mostrar respuestas con
 * citations inventadas (Anejo XII §4.2, EBA GL 2025/99) sin alerta es
 * que un Risk Manager confía en la respuesta sin saber que el modelo
 * inventó sus fuentes.
 *
 * Heurística de "candidatos": busca patrones genéricos que parecen
 * referencias regulatorias (palabra reservada + número/articulo) y las
 * resta de las validadas. Falsos positivos son aceptables (mejor
 * advertir de más que de menos).
 */
const CANDIDATE_REGEX = /\b(?:EBA(?:\s+GL)?|CRR\d?|Anejo\s+\w+|SR\s+\d+-\d+|IFRS\s+\d+|BCBS|MaRisk|Basel|CRD\s*\d+)\b[^.,;:\n]*?(?:\d+(?:[./]\d+)*[a-z]?(?:\(\d+\))?(?:\s*§\s*[A-Za-z0-9.]+)?)?/gi;

export interface CitationsExtractionResult {
  validated: CopilotCitation[];
  /** Texto que parecía citation pero no matchea pattern canónica. */
  unverifiedCandidates: string[];
}

export function extractCitationsWithVerification(text: string): CitationsExtractionResult {
  if (!text) return { validated: [], unverifiedCandidates: [] };
  const validated = extractValidatedCitations(text);
  const validatedLabels = new Set(validated.map((c) => c.label));
  const allCandidates = new Set<string>();
  for (const match of text.matchAll(CANDIDATE_REGEX)) {
    const candidate = normalizeLabel(match[0]);
    if (candidate.length < 5) continue; // descarta ruido tipo "EBA"
    allCandidates.add(candidate);
  }
  const unverifiedCandidates: string[] = [];
  for (const candidate of allCandidates) {
    // Es validado si matchea anchored alguna pattern, o es subcadena
    // de una etiqueta validada (e.g. "EBA GL 2018/02 §3.4" engloba
    // "EBA GL 2018/02").
    const isValidated = validatedLabels.has(candidate)
      || Array.from(validatedLabels).some((label) => label.includes(candidate) || candidate.includes(label));
    if (!isValidated) unverifiedCandidates.push(candidate);
  }
  return { validated, unverifiedCandidates };
}

/**
 * Validates a list of pre-extracted candidates (e.g. when Gemini
 * returns citations as a structured array). Each candidate must match
 * one of the patterns to be kept.
 */
export function filterValidCitations(candidates: string[]): CopilotCitation[] {
  const valid: CopilotCitation[] = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    if (!c) continue;
    const normalized = normalizeLabel(c.trim());
    if (seen.has(normalized)) continue;
    if (matchesAnyPattern(normalized)) {
      seen.add(normalized);
      valid.push({ label: normalized });
    }
  }
  return valid;
}

function matchesAnyPattern(text: string): boolean {
  return PATTERNS.some(({ regex }) => {
    const anchored = new RegExp(`^${regex.source}$`, regex.flags.replace('g', ''));
    return anchored.test(text);
  });
}

function normalizeLabel(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

export const __copilotCitationInternals = { PATTERNS };
