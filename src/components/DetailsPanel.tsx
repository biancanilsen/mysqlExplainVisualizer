import type { ExecNode } from '../lib/explain/types'
import { Card, CardHeader, CardBody, Chip, Textarea, Button } from '@heroui/react'

function humanAccess(access?: string): string {
  const v = (access ?? '').toLowerCase()
  switch (v) {
    case 'all': return 'Full Table Scan'
    case 'ref': return 'Busca por Índice'
    case 'eq_ref': return 'Busca por Índice (Única)'
    case 'range': return 'Varredura por Intervalo'
    case 'index': return 'Varredura por Índice'
    case 'system': return 'Tabela do Sistema'
    case 'const': return 'Constante'
    default: return access ?? 'operação'
  }
}

export default function DetailsPanel({ node, goToAgent }: { node?: ExecNode | null, goToAgent: any }) {
  const raw = (node?.raw ?? {}) as Record<string, unknown>

  const badges: { text: string; color: string }[] = []
  if ((node?.accessType ?? '').toUpperCase() === 'ALL') badges.push({ text: 'FULL SCAN', color: 'bg-red-600' })
  if (raw.using_filesort === true) badges.push({ text: 'FILESORT', color: 'bg-amber-500' })
  if (raw.using_temporary_table === true) badges.push({ text: 'TEMP TABLE', color: 'bg-amber-500' })

  return (
    <Card shadow="sm" radius="sm" className="border border-gray-200 dark:border-gray-700 h-full flex flex-col">
      <CardHeader className="pb-0 flex-shrink-0">
        <h3 className="font-semibold">Detalhes do Nó</h3>
      </CardHeader>
      <CardBody className="pt-3 flex-1 min-h-0 flex flex-col">
        {!node ? (
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Selecione um nó no diagrama para ver os detalhes.
          </p>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col gap-3">
            {/* Seção de informações (40%) */}
            <div className="flex-[0_0_20%] min-h-0 overflow-auto space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                {badges.map((b, i) => (
                  <Chip
                    key={i}
                    size="sm"
                    variant="flat"
                    color={b.color === 'bg-red-600' ? 'danger' : 'warning'}
                    className="text-[10px] font-semibold"
                  >
                    {b.text}
                  </Chip>
                ))}
              </div>

              <div className="text-sm text-gray-700 dark:text-gray-200 space-y-1">
                <div><strong>Tipo de Acesso:</strong> {humanAccess(node.accessType)}</div>
                <div><strong>Tabela:</strong> {node.table ?? '-'}</div>
                <div><strong>Custo (prefix_cost):</strong> {Number.isFinite(node.cost) ? node.cost.toFixed(2) : '-'}</div>
                <div><strong>Linhas Lidas (rows_examined_per_scan):</strong> {node.rowsExamined ?? '-'}</div>
                <div><strong>Linhas Produzidas (rows_produced_per_join):</strong> {node.rowsProduced ?? '-'}</div>
              </div>
            </div>

            {/* JSON Bruto (60%) */}
            <div className="flex-[0_0_60%] min-h-0 flex flex-col">
              <div className="text-xs font-semibold mb-1">JSON Bruto</div>
              <Textarea
                label="JSON Bruto"
                placeholder=""
                value={JSON.stringify(node.raw, null, 2)}
                className="h-full"
                classNames={{ input: "h-full resize-none", inputWrapper: "h-full" }}
                // maxRows={30}
              />
            </div>
            <div className="flex-[0_0_10%] min-h-0 overflow-auto space-y-3">
              <div className="text-xs font-semibold mb-1">Experimente o agente de SQL</div>
                <Button color="primary" onPress={goToAgent} size="md" className="w-full mb-2">
                Analisar
              </Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  )
}