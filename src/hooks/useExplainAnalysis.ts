import { useState, useMemo, useEffect } from 'react';
import mermaid from 'mermaid';
import { parseExplainToTree } from '../lib/explain/normalize';
import { toExplainJSONFromAnalyzeText } from '../lib/explain/parseText';
import { generateAlerts } from '../lib/explain/heuristics';
import { buildMermaid } from '../lib/mermaid/buildGraph';
import type { Alert, ExecNode, ExplainJSON } from '../lib/explain/types';
import { toNumber } from '../lib/explain/types';
import { jsonExample } from '../utils/jsonExemple';

export function useExplainAnalysis() {
  const [input, setInput] = useState(JSON.stringify(jsonExample, null, 2));
  const [graphDef, setGraphDef] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [nodes, setNodes] = useState<ExecNode[]>([]);
  const [root, setRoot] = useState<ExecNode | null>(null);
  const [totalCost, setTotalCost] = useState(0);
  const [queryCost, setQueryCost] = useState(0);
  const [actualTimeMs, setActualTimeMs] = useState(0);
  const [totalLoops, setTotalLoops] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const idMap = useMemo(() => {
    const map = new Map<string, ExecNode>();
    for (const n of nodes) map.set(n.id, n);
    return map;
  }, [nodes]);

  const selectedNode = selectedId ? idMap.get(selectedId) ?? null : null;

  const analyze = () => {
    const text = input.trim();
    setSelectedId(null);

    // 1) JSON (se parecer JSON)
    try {
      if (text.startsWith('{') || text.startsWith('[')) {
        const parsed = JSON.parse(text) as ExplainJSON;
        const { root, nodes, totalCost } = parseExplainToTree(parsed);

        const qc = toNumber(parsed.query_block?.cost_info?.query_cost, 0);
        const atMs = toNumber((parsed.query_block as any)?.actual_time_ms, 0);
        const loopsSum = nodes.reduce(
          (acc, n) => acc + toNumber(((n.raw as any)?.loops as any), 0),
          0
        );

        setRoot(root);
        setNodes(nodes);
        setTotalCost(totalCost);
        setQueryCost(qc);
        setActualTimeMs(atMs);
        setTotalLoops(loopsSum);
        setGraphDef(buildMermaid(root, nodes, null));
        setAlerts(generateAlerts(nodes, totalCost));
        return;
      }
    } catch (_err) {
      // se falhar, cai para o parser de texto
    }

    // 2) Fallback: EXPLAIN ANALYZE (texto) → converte para JSON e normaliza
    try {
      const explain = toExplainJSONFromAnalyzeText(text);
      const qc = toNumber(explain.query_block?.cost_info?.query_cost, 0);
      const atMs = toNumber((explain.query_block as any)?.actual_time_ms, 0);

      const { root, nodes, totalCost } = parseExplainToTree(explain);
      const loopsSum = nodes.reduce(
        (acc, n) => acc + toNumber(((n.raw as any)?.loops as any), 0),
        0
      );

      setRoot(root);
      setNodes(nodes);
      setTotalCost(totalCost);
      setQueryCost(qc);
      setActualTimeMs(atMs);
      setTotalLoops(loopsSum);
      setGraphDef(buildMermaid(root, nodes, null));
      setAlerts(generateAlerts(nodes, totalCost));
    } catch (e: unknown) {
      setGraphDef(null);
      setRoot(null);
      setNodes([]);
      setQueryCost(0);
      setActualTimeMs(0);
      setTotalLoops(0);
      setAlerts([{
        type: 'ALERTA',
        code: 'BOTTLENECK',
        severity: 'low',
        message: 'Entrada inválida. Cole o EXPLAIN ANALYZE (texto) ou EXPLAIN FORMAT=JSON.',
      }]);
      console.error('Parse error:', e instanceof Error ? e.message : String(e));
    }
  };

  // Efeito para inicializar o Mermaid e analisar o JSON de exemplo
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: 'default',
      flowchart: { htmlLabels: true, curve: 'linear' },
    });
    window.__onMermaidNodeClick = (id: string) => {
      setSelectedId(id);
    };
    analyze();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Efeito para reconstruir o gráfico quando a seleção muda
  useEffect(() => {
    if (!root) return;
    setGraphDef(buildMermaid(root, nodes, selectedId));
  }, [selectedId, root, nodes]);

  return {
    input,
    setInput,
    graphDef,
    alerts,
    nodes,
    totalCost,
    queryCost,
    actualTimeMs,
    totalLoops,
    selectedId,
    selectedNode,
    analyze,
  };
}