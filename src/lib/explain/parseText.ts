import type { ExplainJSON, TableNode } from './types'
import { toNumber } from './types'
import { parseExplainToTree, type ParseResult } from './normalize'

/**
 * Helpers to parse numeric fields that may carry K/M/G suffixes.
 */
function parseNumberWithUnit(v?: string): number {
  if (!v) return 0
  const m = v.match(/^([0-9]*\.?[0-9]+)\s*([kKmMgG])?$/)
  if (!m) return toNumber(v, 0)
  const val = parseFloat(m[1]!)
  const suf = (m[2] ?? '').toUpperCase()
  const mul = suf === 'K' ? 1_000 : suf === 'M' ? 1_000_000 : suf === 'G' ? 1_000_000_000 : 1
  return val * mul
}

function extractKVParams(paren: string | null): Record<string, string> {
  const out: Record<string, string> = {}
  if (!paren) return out
  // Accepts keys like: cost=..., rows=..., loops=...  (we parse actual time separately)
  const re = /([a-zA-Z_]+)\s*=\s*([0-9]*\.?[0-9]+(?:[kKmMgG])?)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(paren)) !== null) {
    out[m[1]!.toLowerCase()] = m[2]!
  }
  return out
}

// Parse "actual time=a..b" (seconds) and return the 'b' as milliseconds
function extractActualTimeMs(paren: string | null): number | undefined {
  if (!paren) return undefined
  const m = paren.match(/actual\s*time\s*=\s*([0-9.eE+\-]+)\.\.([0-9.eE+\-]+)/i)
  if (!m) return undefined
  const lastSec = Number.parseFloat(m[2]!)
  if (!Number.isFinite(lastSec)) return undefined
  return Math.max(0, Math.round(lastSec * 1000))
}

function extractParensGroups(line: string): string[] {
  // Collect all "(...)" groups in order as they appear on the line
  const list: string[] = []
  const re = /\(([^()]*)\)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    list.push(m[1] ?? '')
  }
  return list
}

function extractTable(opText: string): string | undefined {
  // Matches: "on p", "on ecommerce_db.p", "on `schema`.`table`"
  const m =
    opText.match(/\bon\s+(`[^`]+`(?:\.`[^`]+`)?)\b/i) ||
    opText.match(/\bon\s+([^\s(]+)\b/i)
  return m ? m[1] : undefined
}

function extractKeyName(opText: string): string | undefined {
  // Matches: "using PRIMARY", "using fk_itens_pedido"
  const m = opText.match(/\busing\s+([^\s(]+)\b/i)
  return m ? m[1] : undefined
}

type AccessKind = { accessType?: string; table?: string; key?: string }

function classifyAccess(opText: string): AccessKind {
  const s = opText.trim()
  const lower = s.toLowerCase()

  // Plan-level headers
  if (/^nested\s+loop/.test(lower)) {
    return { accessType: 'nested_loop' }
  }
  if (/^hash\s+join\b/.test(lower)) {
    return { accessType: 'hash_join' }
  }

  // Non-table operation hints
  if (/^filter\b/.test(lower)) {
    return { accessType: 'filter' }
  }
  if (/^sort\b|filesort/.test(lower)) {
    return { accessType: 'sort' }
  }
  if (/^group\s+by\b/.test(lower)) {
    return { accessType: 'group_by' }
  }
  if (/^limit\b/.test(lower)) {
    return { accessType: 'limit' }
  }

  // Table-level ops (MySQL EXPLAIN ANALYZE textual forms)
  if (/^(?:full\s+)?table\s+scan\s+on\b/i.test(s)) {
    return { accessType: 'ALL', table: extractTable(s), key: extractKeyName(s) }
  }
  if (/^index\s+range\s+scan(?:\s+(?:ascending|descending))?\s+on\b/i.test(s)
      || /^range\s+scan(?:\s+(?:ascending|descending))?\s+on\b/i.test(s)) {
    return { accessType: 'range', table: extractTable(s), key: extractKeyName(s) }
  }
  if (/^index\s+skip\s+scan\s+on\b/i.test(s)) {
    return { accessType: 'index_skip_scan', table: extractTable(s), key: extractKeyName(s) }
  }
  if (/^single[-\s]row\s+(?:index\s+)?lookup\s+on\b/i.test(s)) {
    return { accessType: 'eq_ref', table: extractTable(s), key: extractKeyName(s) }
  }
  if (/^unique\s+(?:index\s+)?lookup\s+on\b/i.test(s)) {
    return { accessType: 'eq_ref', table: extractTable(s), key: extractKeyName(s) }
  }
  if (/^hash\s+lookup\s+on\b/i.test(s)) {
    // Treat as ref; mark hash in raw later
    return { accessType: 'ref', table: extractTable(s), key: extractKeyName(s) }
  }
  if (/^build\s+hash\s+on\b/i.test(s)) {
    return { accessType: 'hash_build', table: extractTable(s), key: extractKeyName(s) }
  }
  if (/^table\s+lookup\s+on\b/i.test(s)) {
    return { accessType: 'ref', table: extractTable(s), key: extractKeyName(s) }
  }
  if (/^covering\s+index\s+lookup\s+on\b/i.test(s)) {
    return { accessType: 'ref', table: extractTable(s), key: extractKeyName(s) }
  }
  if (/^index\s+lookup\s+on\b/i.test(s)) {
    return { accessType: 'ref', table: extractTable(s), key: extractKeyName(s) }
  }
  if (/^full\s+index\s+scan\s+on\b/i.test(s)) {
    return { accessType: 'index', table: extractTable(s), key: extractKeyName(s) }
  }

  // Fallback: try to infer a table if "on <name>" exists
  const maybeTbl = extractTable(s)
  if (maybeTbl) {
    return { accessType: undefined, table: maybeTbl, key: extractKeyName(s) }
  }
  return { accessType: undefined }
}

/**
 * Convert EXPLAIN ANALYZE text into a minimal ExplainJSON structure
 * so we can reuse the JSON pipeline uniformly.
 */
export function toExplainJSONFromAnalyzeText(input: string): ExplainJSON {
  let planCost = 0
  let planHasHashJoin = false
  let planActualTimeMs = 0
  const nested: Array<{ table: TableNode }> = []
  let lastTable: TableNode | null = null

  const lines = input.split(/\r?\n/)
  for (const rawLine of lines) {
    let line = rawLine.replace(/\t/g, '  ').trim()
    if (!line) continue
    if (line.startsWith('->')) line = line.slice(2).trim()

    // Collect "(...)" groups and classify operation text without parentheses
    const parens = extractParensGroups(line)
    const opText = line.replace(/\([^()]*\)/g, '').trim()
    const kind = classifyAccess(opText)

    // Plan header: Nested loop or Hash join → capture total plan cost and join type
    if (kind.accessType === 'nested_loop' || kind.accessType === 'hash_join') {
      const fp = parens.length > 0 ? extractKVParams(parens[0] ?? null) : {}
      const c = parseNumberWithUnit((fp as any)['cost'])
      if (Number.isFinite(c) && c > planCost) planCost = c

      // Try to capture the largest 'actual time' observed on header line
      for (const g of parens) {
        const ms = extractActualTimeMs(g)
        if (typeof ms === 'number' && ms > planActualTimeMs) planActualTimeMs = ms
      }

      if (kind.accessType === 'hash_join' || /^hash\s+join\b/i.test(opText)) planHasHashJoin = true
      continue
    }

    // Table-level step → build a TableNode compatible with ExplainJSON
    if (kind.table) {
      // First "(...)" with estimates (cost/rows)
      let estParams: Record<string, string> = {}
      for (let i = 0; i < parens.length; i++) {
        const kv = extractKVParams(parens[i] ?? null)
        if (kv['cost'] !== undefined || kv['rows'] !== undefined) {
          estParams = kv
          break
        }
      }
      // Last "(...)" with actual rows/loops
      let actParams: Record<string, string> = {}
      for (let i = parens.length - 1; i >= 0; i--) {
        const kv = extractKVParams(parens[i] ?? null)
        if (kv['rows'] !== undefined || kv['loops'] !== undefined) {
          actParams = kv
          break
        }
      }

      const cost = parseNumberWithUnit((estParams as any)['cost'])
      const rowsEst = parseNumberWithUnit((estParams as any)['rows'])
      const rowsAct = parseNumberWithUnit((actParams as any)['rows'])
      const loops = parseNumberWithUnit((actParams as any)['loops'])

      // EXPLAIN ANALYZE rows are per-loop → multiply by loops to get total produced
      const rowsActTotal =
        Number.isFinite(rowsAct) && Number.isFinite(loops) && loops > 0 ? rowsAct * loops : rowsAct

      // Prefer estimate for "examined" (per scan); fallback to actual total when estimate missing
      const rowsExamined =
        Number.isFinite(rowsEst) && rowsEst > 0
          ? rowsEst
          : (Number.isFinite(rowsActTotal) ? rowsActTotal : undefined)

      // Prefer actual total for "produced"; fallback to estimate
      const rowsProduced =
        Number.isFinite(rowsActTotal) && rowsActTotal > 0
          ? rowsActTotal
          : (Number.isFinite(rowsEst) ? rowsEst : undefined)

      const t: TableNode = {
        table_name: kind.table!,
        access_type: kind.accessType,
        key: kind.key ?? undefined,
        rows_examined_per_scan: rowsExamined as any,
        rows_produced_per_join: rowsProduced as any,
        cost_info: { prefix_cost: cost },
      }

      // Persist loops per node (for total loops KPI)
      if (Number.isFinite(loops) && loops > 0) (t as any).loops = loops

      // Capture per-node actual time (last) if present (optional, might help future KPIs)
      for (const g of parens) {
        const ms = extractActualTimeMs(g)
        if (typeof ms === 'number') {
          (t as any).actual_time_last_ms = ms
          break
        }
      }

      // Inline flags possibly present in the op text
      const lower = opText.toLowerCase()
      if (/\busing\s+index\b|\bcovering\s+index\b/i.test(lower)) (t as any).using_index = true
      if (planHasHashJoin || /\bhash\s+(?:join|lookup|build)\b/i.test(lower)) (t as any).using_hash_join = true
      if (/(?:\bfilesort\b|\bsort\b)/i.test(lower)) (t as any).using_filesort = true
      if (/(?:temporary\s+table|temp\s+table)/i.test(lower)) (t as any).using_temporary_table = true
      if (/\bjoin\s+buffer\b/i.test(lower)) (t as any).using_join_buffer = true
      const f = opText.match(/filter:\s*(.*)$/i)
      if (f) (t as any).attached_condition = f[1]?.trim()

      nested.push({ table: t })
      lastTable = t
      continue
    }

    // Non-table line: attach flags to the last table node
    if (lastTable) {
      const lower = opText.toLowerCase()
      if (/(?:\bfilesort\b|\bsort\b)/i.test(lower)) (lastTable as any).using_filesort = true
      if (/(?:temporary\s+table|temp\s+table)/i.test(lower)) (lastTable as any).using_temporary_table = true
      if (/\bjoin\s+buffer\b/i.test(lower)) (lastTable as any).using_join_buffer = true
      if (/\bhash\s+(?:join|lookup|build)\b/i.test(lower)) (lastTable as any).using_hash_join = true
      const f = opText.match(/filter:\s*(.*)$/i)
      if (f) lastTable.attached_condition = f[1]?.trim()
    }
  }

  const qb: any = {
    select_id: 1,
    cost_info: { query_cost: planCost },
    nested_loop: nested,
  }
  if (planActualTimeMs > 0) qb.actual_time_ms = planActualTimeMs

  const explain: ExplainJSON = {
    query_block: qb,
  }
  return explain
}

/**
 * Public API used by the UI when the input is EXPLAIN ANALYZE (texto).
 * Converts to ExplainJSON and delegates to the standard JSON parser.
 */
export function parseExplainAnalyzeText(input: string): ParseResult {
  const explain = toExplainJSONFromAnalyzeText(input)
  return parseExplainToTree(explain)
}