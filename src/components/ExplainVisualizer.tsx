
import mermaid from 'mermaid'
import { parseExplainToTree } from '../lib/explain/normalize'
import { generateAlerts } from '../lib/explain/heuristics'
import type { Alert, ExecNode, ExplainJSON } from '../lib/explain/types'
import { buildMermaid } from '../lib/mermaid/buildGraph'
import AnalysisPanel from './AnalysisPanel'
import DetailsPanel from './DetailsPanel'
import { Button, Card, CardBody, CardHeader, ScrollShadow, Textarea } from '@heroui/react'
import { useEffect, useMemo, useRef, useState } from 'react'

declare global {
  interface Window {
    __onMermaidNodeClick: (id: string) => void
  }
}

const SAMPLE_JSON = `{
  "query_block": {
    "select_id": 1,
    "cost_info": { "query_cost": "20485.80" },
    "nested_loop": [
      {
        "table": {
          "table_name": "c",
          "access_type": "ALL",
          "possible_keys": ["PRIMARY"],
          "rows_examined_per_scan": 9968,
          "rows_produced_per_join": 9968,
          "filtered": "10.00",
          "cost_info": {
            "read_cost": "1843.89",
            "eval_cost": "996.80",
            "prefix_cost": "2840.69",
            "data_read_per_join": "459K"
          },
          "used_columns": ["id", "nome"],
          "attached_condition": "(\`ecommerce_treinamento\`.\`c\`.\`id\` < 200)"
        }
      },
      {
        "table": {
          "table_name": "p",
          "access_type": "ref",
          "possible_keys": ["fk_pedidos_clientes"],
          "key": "fk_pedidos_clientes",
          "used_key_parts": ["id_cliente"],
          "key_length": "4",
          "ref": [ "ecommerce_treinamento.c.id" ],
          "rows_examined_per_scan": 1,
          "rows_produced_per_join": 996,
          "filtered": "100.00",
          "cost_info": {
            "read_cost": "996.80",
            "eval_cost": "199.36",
            "prefix_cost": "20485.80",
            "data_read_per_join": "32K"
          },
          "used_columns": ["id","id_cliente","valor"]
        }
      }
    ]
  }
}`

export default function ExplainVisualizer() {
  const [input, setInput] = useState(SAMPLE_JSON)
  const [graphDef, setGraphDef] = useState<string | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [nodes, setNodes] = useState<ExecNode[]>([])
  const [root, setRoot] = useState<ExecNode | null>(null)
  const [totalCost, setTotalCost] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const idMap = useMemo(() => {
    const map = new Map<string, ExecNode>()
    for (const n of nodes) map.set(n.id, n)
    return map
  }, [nodes])

  const selectedNode = selectedId ? idMap.get(selectedId) ?? null : null

  // Initialize Mermaid and bind click handler
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: 'default',
      flowchart: { htmlLabels: true, curve: 'linear' },
    })
    window.__onMermaidNodeClick = (id: string) => {
      setSelectedId(id)
    }
    // Run once with sample JSON
    try {
      analyze()
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Auto-analyze failed:', e)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Render Mermaid whenever graphDef changes. Also add hover tooltips.
  useEffect(() => {
    if (!graphDef || !containerRef.current) return
    let cancelled = false
    ;(async () => {
      const el = containerRef.current!
      el.innerHTML = ''
      try {
        const { svg, bindFunctions } = await mermaid.render(`graph-${Date.now()}`, graphDef)
        if (!cancelled) {
          el.innerHTML = svg
          bindFunctions?.(el)
          // Add simple tooltips with cost and row metrics
          try {
            for (const n of nodes) {
              const target = el.querySelector(`#${CSS.escape(n.id)}`)
              if (!target) continue
              const oldTitle = target.querySelector('title')
              if (oldTitle) oldTitle.remove()
              const title = document.createElementNS('http://www.w3.org/2000/svg', 'title')
              const cost = Number.isFinite(n.cost) ? n.cost.toFixed(2) : '-'
              const rx = n.rowsExamined ?? '-'
              const rp = n.rowsProduced ?? '-'
              title.textContent = `Custo: ${cost} | Linhas Lidas: ${rx} | Linhas Produzidas: ${rp}`
              target.appendChild(title)
            }
          } catch {
            // ignore tooltip errors
          }
        }
      } catch (e) {
        el.innerHTML = '<div class="text-red-600">Falha ao renderizar diagrama.</div>'
        // eslint-disable-next-line no-console
        console.error(e)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [graphDef, nodes])

  // Rebuild the graph when selection or nodes/root change (to highlight selection)
  useEffect(() => {
    if (!root) return
    setGraphDef(buildMermaid(root, nodes, selectedId))
  }, [selectedId, nodes, root])

  function analyze() {
    try {
      const parsed = JSON.parse(input) as ExplainJSON
      const { root, nodes, totalCost } = parseExplainToTree(parsed)
      setRoot(root)
      setNodes(nodes)
      setTotalCost(totalCost)
      setSelectedId(null)
      setGraphDef(buildMermaid(root, nodes, null))
      setAlerts(generateAlerts(parsed, nodes, totalCost))
    } catch (e: unknown) {
      setGraphDef(null)
      setRoot(null)
      setNodes([])
      setAlerts([{
        type: 'ALERTA',
        code: 'BOTTLENECK',
        severity: 'low',
        message: 'JSON inválido. Verifique se o conteúdo é um EXPLAIN FORMAT=JSON válido.',
      }])
      // eslint-disable-next-line no-console
      console.error('Parse error:', e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold">MySQL Explain Visualizer</h1>
          <div className="text-sm text-gray-600 dark:text-gray-300">
            Custo total estimado: <span className="font-mono">{totalCost.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Main Content - Grid Layout */}
      <div className="flex-1 grid grid-cols-12 gap-4 p-4 max-w-7xl mx-auto w-full min-h-0">
        {/* Left panel: JSON Input */}
        <div className="col-span-12 lg:col-span-3 flex flex-col min-h-0">
          <Card shadow="sm" radius="sm" className="border border-gray-200 dark:border-gray-700 h-full flex flex-col">
            <CardHeader className="pb-0 flex-shrink-0">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  Cole aqui o JSON do EXPLAIN FORMAT=JSON
                </span>
              </div>
            </CardHeader>
            <CardBody className="flex-1 flex flex-col space-y-3 min-h-0">
              <div className="flex-1 min-h-0">
                <Textarea
                  label="JSON do EXPLAIN"
                  placeholder="Cole aqui o JSON do EXPLAIN FORMAT=JSON"
                  variant="bordered"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="h-full"
                  classNames={{
                    input: "h-full resize-none",
                    inputWrapper: "h-full"
                  }}
                />
              </div>
              <div className="flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Button color="primary" onPress={analyze} size="sm">
                    Analisar
                  </Button>
                  <span className="text-xs text-gray-500">
                    Dica: O diagrama é interativo — clique em um nó para ver os detalhes.
                  </span>
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <AnalysisPanel alerts={alerts} selectedId={selectedId} variant="bare" />
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Center panel: Diagram */}
        <div className="col-span-12 lg:col-span-6 flex flex-col min-h-0">
          <Card shadow="sm" radius="sm" className="border border-gray-200 dark:border-gray-700 h-full flex flex-col">
            <CardHeader className="pb-0 flex-shrink-0">
              <div className="font-semibold">Plano de Execução (Diagrama)</div>
            </CardHeader>
            <CardBody className="flex-1 min-h-0">
              <ScrollShadow className="h-full">
                <div ref={containerRef} className="mermaid-container" />
              </ScrollShadow>
            </CardBody>
          </Card>
        </div>

        {/* Right panel: Details */}
        <div className="col-span-12 lg:col-span-3 flex flex-col min-h-0">
          <DetailsPanel node={selectedNode} />
        </div>
      </div>
    </div>
  )
}