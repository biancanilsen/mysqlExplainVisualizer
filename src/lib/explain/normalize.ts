import type { ExplainJSON, NodeWrapper, TableNode, ExecNode } from './types'
import { toNumber } from './types'

export interface ParseResult {
  root: ExecNode | null
  nodes: ExecNode[]
  totalCost: number
}

let __id = 0
function genId() {
  __id += 1
  return `n${__id}`
}

function toExecNodeFromTable(t: TableNode): ExecNode {
  const cost =
    toNumber(t.cost_info?.prefix_cost) ||
    toNumber(t.cost_info?.query_cost) ||
    0

  const rowsExamined = t.rows_examined_per_scan
  const rowsProduced = t.rows_produced_per_join

  return {
    id: genId(),
    accessType: t.access_type,
    table: t.table_name,
    cost,
    rowsExamined,
    rowsProduced,
    raw: t,
    children: [],
  }
}

function buildFromNestedLoop(loop?: NodeWrapper[]): ExecNode | null {
  if (!loop || loop.length === 0) return null

  let current: ExecNode | null = null
  for (const w of loop) {
    let node: ExecNode | null = null

    if (w.table) {
      node = toExecNodeFromTable(w.table)
    } else if (w.nested_loop) {
      node = buildFromNestedLoop(w.nested_loop)
    } else {
      // Fallback for other operation nodes we don't model explicitly
      const op = Object.keys(w)[0] ?? 'op'
      node = {
        id: genId(),
        accessType: op,
        table: undefined,
        cost: 0,
        rowsExamined: undefined,
        rowsProduced: undefined,
        raw: w,
        children: [],
      }
    }

    if (!node) continue
    if (current) node.children.push(current)
    current = node
  }

  return current
}

function collectNodes(root: ExecNode | null): ExecNode[] {
  if (!root) return []
  const out: ExecNode[] = []
  const q: ExecNode[] = [root]
  while (q.length) {
    const n = q.shift()!
    out.push(n)
    for (const c of n.children) q.push(c)
  }
  return out
}

export function parseExplainToTree(explain: ExplainJSON): ParseResult {
  __id = 0
  const totalCost = toNumber(explain.query_block?.cost_info?.query_cost, 0)
  const root = buildFromNestedLoop(explain.query_block?.nested_loop)
  const nodes = collectNodes(root)

  // Ensure root reflects total cost if available
  if (root && totalCost && totalCost > root.cost) {
    root.cost = totalCost
  }

  const effectiveTotal =
    totalCost || (nodes.length ? Math.max(...nodes.map((n) => n.cost)) : 0)

  return { root, nodes, totalCost: effectiveTotal }
}