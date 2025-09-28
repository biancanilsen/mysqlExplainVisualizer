import type { ExecNode } from '../explain/types'

function humanAccess(access?: string): string {
  const v = (access ?? '').toLowerCase()
  switch (v) {
    case 'all': return 'Leitura Completa'
    case 'ref': return 'Busca por Índice'
    case 'eq_ref': return 'Busca por Índice (Única)'
    case 'range': return 'Varredura por Intervalo'
    case 'index': return 'Varredura por Índice'
    case 'system': return 'Tabela do Sistema'
    case 'const': return 'Constante'
    default: return access ?? 'operação'
  }
}

function titleFor(n: ExecNode): string {
  const op = humanAccess(n.accessType)
  const tbl = n.table ? ` em \`${n.table}\`` : ''
  return `${op}${tbl}`
}

function makeBadge(text: string, color: 'red' | 'amber'): string {
  const bg = color === 'red' ? '#ef4444' : '#f59e0b'
  const fg = '#111827'
  return `<span style="display:inline-block;background:${bg};color:${fg};border-radius:6px;padding:2px 6px;margin-left:6px;font-size:10px;line-height:1;font-weight:600;">${text}</span>`
}

function htmlCard(n: ExecNode): string {
  const cost = Number.isFinite(n.cost) ? n.cost.toFixed(2) : '-'
  const rx = n.rowsExamined ?? '-'
  const rp = n.rowsProduced ?? '-'

  const badges: string[] = []
  if ((n.accessType ?? '').toUpperCase() === 'ALL') badges.push(makeBadge('FULL SCAN', 'red'))

  const raw = (n.raw ?? {}) as Record<string, unknown>
  if (raw['using_filesort'] === true) badges.push(makeBadge('FILESORT', 'amber'))
  if (raw['using_temporary_table'] === true) badges.push(makeBadge('TEMP TABLE', 'amber'))

  const safe = (s: string) => s.replace(/"/g, '"')

  const html = `
<div style="display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:6px;">
  <div style="display:flex;align-items:center;gap:8px;font-weight:700;">
    <span>${titleFor(n)}</span>
    <span>${badges.join(' ')}</span>
  </div>
  <div style="display:flex;flex-direction:column;gap:2px;font-size:12px;">
    <div>Custo: <strong>${cost}</strong></div>
    <div>Linhas Lidas: <strong>${rx}</strong></div>
    <div>Linhas Produzidas: <strong>${rp}</strong></div>
  </div>
</div>`.trim()

  return safe(html)
}

/**
 * Build Mermaid flowchart with:
 * - Card-like node labels (HTML) including title, metrics, and badges
 * - Cost-based coloring (hot/warm/cool)
 * - Edge labels with rows flowing between nodes (rowsProduced)
 * - Selected node highlighting
 */
export function buildMermaid(root: ExecNode | null, nodes: ExecNode[], selectedId?: string | null): string {
  const lines: string[] = []
  lines.push('flowchart TD')

  if (!root || nodes.length === 0) {
    lines.push('empty["Cole o JSON do EXPLAIN e clique em Analisar"]')
    return lines.join('\n')
  }

  const maxCost = Math.max(...nodes.map((n) => n.cost))
  const clsFor = (n: ExecNode) => {
    if (n.cost === maxCost) return 'hot'
    if (n.cost >= 0.25 * maxCost) return 'warm'
    return 'cool'
  }

  // Node definitions with HTML labels
  for (const n of nodes) {
    const id = n.id
    const html = htmlCard(n)
    // Using HTML label via securityLevel: 'loose' + htmlLabels: true
    lines.push(`${id}["${html}"]`)
  }

  // Edges: top-down. Annotate with rows produced by the child node.
  const q: ExecNode[] = [root]
  while (q.length) {
    const cur = q.shift()!
    for (const c of cur.children) {
      const edgeLabel = (c.rowsProduced ?? c.rowsExamined ?? '?') + ''
      lines.push(`${cur.id} -- "${edgeLabel}" --> ${c.id}`)
      q.push(c)
    }
  }

  // Classes: heat map + selection
  lines.push('classDef hot fill:#f87171,stroke:#991b1b,stroke-width:2px,color:#111')
  lines.push('classDef warm fill:#fbbf24,stroke:#92400e,stroke-width:2px,color:#111')
  lines.push('classDef cool fill:#86efac,stroke:#065f46,stroke-width:1px,color:#111')
  lines.push('classDef selected stroke:#2563eb,stroke-width:3px,color:#111')

  for (const n of nodes) {
    const cls = clsFor(n)
    lines.push(`class ${n.id} ${cls}`)
  }
  if (selectedId) {
    lines.push(`class ${selectedId} selected`)
  }

  // Click bindings for details panel updates
  for (const n of nodes) {
    lines.push(`click ${n.id} call __onMermaidNodeClick("${n.id}") "Detalhes"`)
  }

  return lines.join('\n')
}