import type { Alert, ExplainJSON, ExecNode } from './types'


export function generateAlerts(explain: ExplainJSON, nodes: ExecNode[], totalCost: number): Alert[] {
  const alerts: Alert[] = []

  // 1) FULL TABLE SCAN
  for (const n of nodes) {
    const isAll = (n.accessType ?? '').toUpperCase() === 'ALL'
    const rows = n.rowsExamined ?? 0
    if (isAll && rows > 5000) {
      alerts.push({
        type: 'ALERTA',
        code: 'FULL_TABLE_SCAN',
        severity: 'high',
        nodeId: n.id,
        message:
          `Alerta! A tabela ${n.table ?? '(desconhecida)'} está sendo lida por completo (Full Table Scan). ` +
          'Considere criar um índice na(s) coluna(s) usadas nas cláusulas WHERE ou JOIN para esta tabela.',
      })
    }
  }

  // 2) FILESORT (por nó)
  for (const n of nodes) {
    const raw = n.raw as Record<string, unknown> | undefined
    if (raw?.using_filesort === true) {
      alerts.push({
        type: 'ALERTA',
        code: 'FILE_SORT',
        severity: 'medium',
        nodeId: n.id,
        message:
          'Alerta! Uma operação de ordenação em disco (filesort) foi detectada neste nó. ' +
          'Verifique se a coluna na cláusula ORDER BY pode ser coberta por um índice para obter os dados já ordenados.',
      })
    }
  }

  // 3) TEMPORARY TABLE (por nó)
  for (const n of nodes) {
    const raw = n.raw as Record<string, unknown> | undefined
    if (raw?.using_temporary_table === true) {
      alerts.push({
        type: 'ALERTA',
        code: 'TEMP_TABLE',
        severity: 'medium',
        nodeId: n.id,
        message:
          'Alerta! O MySQL precisou criar uma tabela temporária para resolver a consulta neste nó. ' +
          'Isso geralmente indica uma query complexa com GROUP BY ou UNION que pode ser otimizada, possivelmente com a ajuda de índices.',
      })
    }
  }

  // 4) UNUSED INDEX
  for (const n of nodes) {
    const raw = n.raw as Record<string, unknown> | undefined
    const possible = Array.isArray(raw?.possible_keys) ? (raw!.possible_keys as string[]) : undefined
    const chosen = (raw?.key ?? undefined) as string | undefined
    if (possible && possible.length > 0 && (chosen === undefined || chosen === null)) {
      alerts.push({
        type: 'ALERTA',
        code: 'UNUSED_INDEX',
        severity: 'low',
        nodeId: n.id,
        message:
          `Atenção: A tabela ${n.table ?? '(desconhecida)'} possui índices (${possible.join(', ')}) que poderiam ser usados, ` +
          'mas o otimizador escolheu não usá-los. Verifique se há funções aplicadas às colunas na cláusula WHERE (ex: LOWER(coluna) = ...), ' +
          'o que pode impedir o uso de índices.',
      })
    }
  }

  // 5) BOTTLENECK
  const maxCost = nodes.length ? Math.max(...nodes.map((n) => n.cost)) : 0
  const denom = totalCost || maxCost || 1
  for (const n of nodes.filter((x) => x.cost === maxCost && maxCost > 0)) {
    const pct = Math.min(100, Math.max(0, (n.cost / denom) * 100))
    const pctStr = pct.toFixed(1).replace('.0', '')
    alerts.push({
      type: 'INFORMATIVO',
      code: 'BOTTLENECK',
      severity: 'high',
      nodeId: n.id,
      message:
        `O principal gargalo de performance desta query está na operação de ${n.accessType ?? 'operação'} ` +
        `na tabela ${n.table ?? '(desconhecida)'}, que corresponde a ${pctStr}% do custo total da consulta. ` +
        'Otimizar esta etapa terá o maior impacto.',
    })
  }

  return alerts
}