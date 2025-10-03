import type { Alert, ExecNode } from './types'
import { toNumber } from './types'


export function generateAlerts(nodes: ExecNode[], totalCost: number): Alert[] {
  const alerts: Alert[] = []

  // 1) FULL TABLE SCAN (access_type = ALL)
  // Doc base: EXPLAIN access_type "ALL" indica varredura completa da tabela.
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
          `A tabela ${n.table ?? '(desconhecida)'} está sendo lida por completo (access_type = ALL). ` +
          'Conforme a documentação do MySQL, isso normalmente indica ausência de índice útil. ' +
          'Crie/ajuste índices para as colunas usadas em WHERE/JOIN e garanta seletividade.',
      })
    }
    console.log("isAll: ", isAll);
    console.log("n", n);
  }

  // 2) FULL INDEX SCAN (access_type = index)
  // Doc base: "index" varre todas as entradas do índice (full index scan).
  for (const n of nodes) {
    const isIndexScan = (n.accessType ?? '').toUpperCase() === 'INDEX'
    const rows = n.rowsExamined ?? 0
    if (isIndexScan && rows > 5000) {
      alerts.push({
        type: 'ALERTA',
        code: 'FULL_INDEX_SCAN',
        severity: 'medium',
        nodeId: n.id,
        message:
          'Leitura completa do índice detectada (access_type = index). ' +
          'O otimizador está varrendo todo o índice. Verifique predicados mais seletivos, ' +
          'a ordem das colunas em índices compostos e se é possível reduzir colunas projetadas.',
      })
    }
  }

  // 3) LOW SELECTIVITY (filtered baixo)
  // Doc base: "filtered" é a porcentagem estimada de linhas que passam para a próxima etapa.
  // Valores muito baixos indicam pouca seletividade dos predicados.
  for (const n of nodes) {
    const raw = n.raw as Record<string, unknown> | undefined
    const filteredNum = toNumber(raw?.filtered as any, Number.NaN)
    if (Number.isFinite(filteredNum) && filteredNum < 10) {
      alerts.push({
        type: 'ALERTA',
        code: 'LOW_SELECTIVITY',
        severity: 'medium',
        nodeId: n.id,
        message:
          `Baixa seletividade estimada (filtered ≈ ${filteredNum}%). ` +
          'Valores baixos significam que muitas linhas lidas são descartadas. ' +
          'Aprimore predicados e índices para reduzir linhas examinadas.',
      })
    }
  }

  // 4) FILESORT (por nó) — "Using filesort"
  for (const n of nodes) {
    const raw = n.raw as Record<string, unknown> | undefined
    if (raw?.using_filesort === true) {
      alerts.push({
        type: 'ALERTA',
        code: 'FILE_SORT',
        severity: 'medium',
        nodeId: n.id,
        message:
          'Operação de ordenação em disco (Using filesort) detectada. ' +
          'Cubra a cláusula ORDER BY com um índice para obter dados já ordenados e evitar sort em disco.',
      })
    }
  }

  // 5) TEMPORARY TABLE (por nó) — "Using temporary"
  for (const n of nodes) {
    const raw = n.raw as Record<string, unknown> | undefined
    if (raw?.using_temporary_table === true) {
      alerts.push({
        type: 'ALERTA',
        code: 'TEMP_TABLE',
        severity: 'medium',
        nodeId: n.id,
        message:
          'Criação de tabela temporária (Using temporary) detectada. ' +
          'Isso é comum com GROUP BY/UNION. Avalie índices adequados e reescritas para minimizar materializações.',
      })
    }
  }

  // 6) JOIN BUFFER — "Using join buffer"
  for (const n of nodes) {
    const raw = n.raw as Record<string, unknown> | undefined
    const usingJoinBuffer = (raw as any)?.using_join_buffer
    if (usingJoinBuffer && usingJoinBuffer !== false) {
      const mode = typeof usingJoinBuffer === 'string' ? ` (${usingJoinBuffer})` : ''
      alerts.push({
        type: 'ALERTA',
        code: 'JOIN_BUFFER',
        severity: 'medium',
        nodeId: n.id,
        message:
          `Uso de Join Buffer${mode} detectado. ` +
          'Normalmente indica ausência de índice adequado para o predicado de junção. ' +
          'Crie/ajuste índices nas colunas de JOIN e reavalie a ordem das junções.',
      })
    }
  }

  // 7) COVERING INDEX — "Using index"
  for (const n of nodes) {
    const raw = n.raw as Record<string, unknown> | undefined
    if (raw?.using_index === true) {
      alerts.push({
        type: 'INFORMATIVO',
        code: 'COVERING_INDEX',
        severity: 'low',
        nodeId: n.id,
        message:
          'Using index detectado: a consulta pode ser atendida apenas com dados do índice (covering index), reduzindo I/O de tabela.',
      })
    }
  }

  // 8) UNUSED INDEX — possible_keys presentes mas key não escolhido
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
          `Índices candidatos (${possible.join(', ')}) não foram escolhidos pelo otimizador. ` +
          'Verifique funções nas colunas, tipos incompatíveis, estatísticas e ordem de colunas dos índices.',
      })
    }
  }

  // 8.1) FUNCTION SUPPRESSING INDEX — attached_condition com função sobre coluna
  for (const n of nodes) {
    const raw = n.raw as Record<string, unknown> | undefined
    const attached = (raw as any)?.attached_condition as string | undefined
    if (typeof attached === 'string' && attached.length > 0) {
      // Heurística: detectar função(s) aplicadas a colunas na condição
      const hasSpecificFunc =
        /\b(?:upper|lower|date|cast|convert|coalesce|ifnull|substring|substr|trim|ltrim|rtrim|concat|replace|left|right|abs|floor|ceil|round|year|month|day|from_unixtime|unix_timestamp)\s*\(/i.test(attached)
      const hasGenericFunc = /[a-z_][a-z0-9_]*\s*\(/i.test(attached) // fallback genérico
      const mentionsColumn =
        /`[^`]+`\.`[^`]+`|\b[a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_]*\b/.test(attached)

      const possible = Array.isArray((raw as any)?.possible_keys)
        ? (((raw as any)!.possible_keys) as string[])
        : undefined
      const chosen = (((raw as any)?.key ?? undefined) as string | undefined)
      const access = (n.accessType ?? '').toUpperCase()
      const noIndex = !chosen || access === 'ALL' || access === 'INDEX'

      // Dispara quando há função sobre coluna e o índice não foi usado/efetivo
      if ((mentionsColumn && (hasSpecificFunc || hasGenericFunc)) && (noIndex || (possible && possible.length > 0 && !chosen))) {
        const snippet = attached.length > 160 ? attached.slice(0, 160) + '…' : attached
        alerts.push({
          type: 'ALERTA',
          code: 'FUNCTION_SUPPRESSING_INDEX',
          severity: 'medium',
          nodeId: n.id,
          message:
            'Condição com função aplicada à coluna pode impedir o uso do índice (attached_condition). ' +
            'Evite funções no lado da coluna; normalize valores, reescreva o predicado para comparar a coluna crua, ' +
            'ou utilize coluna gerada indexada para a expressão. ' +
            `Exemplo: ${snippet}`,
        })
      }
    }
  }

  // 9) BOTTLENECK — nó(s) com maior custo relativo
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
        `Gargalo principal em ${n.accessType ?? 'operação'} na tabela ${n.table ?? '(desconhecida)'} ` +
        `(${pctStr}% do custo total). Priorize otimizações aqui.`,
    })
  }

  return alerts
}