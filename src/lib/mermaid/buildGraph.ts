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

function generateNodeText(n: ExecNode): string {
  const op = humanAccess(n.accessType)
  const tbl = n.table ? ` em \`${n.table}\`` : ''
  const title = `${op}${tbl}`

  const cost = `Custo: ${Number.isFinite(n.cost) ? n.cost.toFixed(2) : '-'}`
  const rowsExamined = `Linhas Lidas: ${n.rowsExamined ?? '-'}`
  const rowsProduced = `Linhas Produzidas: ${n.rowsProduced ?? '-'}`
  
  const fullText = `${title}<br/>${cost}<br/>${rowsExamined}<br/>${rowsProduced}`
  return fullText.replace(/"/g, '#quot;')
}


export function buildMermaid(root: ExecNode | null, nodes: ExecNode[], selectedId?: string | null): string {
  const lines: string[] = []
  
  // ================================================================
  // == MUDANÇA PRINCIPAL: De volta para o diagrama Vertical (TD) ==
  // ================================================================
  lines.push('flowchart TD')
  
  lines.push('%%{init: { "theme": "base", "themeVariables": { "fontSize": "13px" } } }%%')

  if (!root || nodes.length === 0) {
    lines.push('empty["Cole o EXPLAIN ANALYZE (texto) ou EXPLAIN FORMAT=JSON e clique em Analisar"]')
    return lines.join('\n')
  }

  const maxCost = Math.max(...nodes.map((n) => n.cost))
  const clsFor = (n: ExecNode) => {
    if (n.cost === maxCost) return 'hot'
    if (n.cost >= 0.25 * maxCost) return 'warm'
    return 'cool'
  }

  for (const n of nodes) {
    const labelText = generateNodeText(n)
    lines.push(`${n.id}["${labelText}"]`)
  }

  const q: ExecNode[] = [root]
  while (q.length) {
    const cur = q.shift()!
    for (const c of cur.children) {
      const edgeLabel = (c.rowsProduced ?? c.rowsExamined ?? '?') + ''
      lines.push(`${cur.id} -- "${edgeLabel}" --> ${c.id}`)
      q.push(c)
    }
  }

  lines.push('classDef hot fill:#ef4444,stroke:#991b1b,stroke-width:2px,color:#111')
  lines.push('classDef warm fill:#f59e0b,stroke:#92400e,stroke-width:2px,color:#111')
  lines.push('classDef cool fill:#86efac,stroke:#065f46,stroke-width:1px,color:#111')
  lines.push('classDef selected stroke:#2563eb,stroke-width:3px,color:#111')

  for (const n of nodes) {
    const cls = clsFor(n)
    lines.push(`class ${n.id} ${cls}`)
  }
  if (selectedId) {
    lines.push(`class ${selectedId} selected`)
  }

  // ================================================================
  // == FUNÇÃO DE CLIQUE REATIVADA ==
  // ================================================================
  for (const n of nodes) {
    lines.push(`click ${n.id} call __onMermaidNodeClick("${n.id}") "Detalhes"`)
  }

  return lines.join('\n')
}