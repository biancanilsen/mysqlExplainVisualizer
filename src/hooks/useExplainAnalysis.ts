import { useState, useMemo, useEffect } from 'react';
import mermaid from 'mermaid';
import { parseExplainToTree } from '../lib/explain/normalize';
import { generateAlerts } from '../lib/explain/heuristics';
import { buildMermaid } from '../lib/mermaid/buildGraph';
import type { Alert, ExecNode, ExplainJSON } from '../lib/explain/types';
import { jsonExample } from '../utils/jsonExemple';

export function useExplainAnalysis() {
  const [input, setInput] = useState(JSON.stringify(jsonExample, null, 2));
  const [graphDef, setGraphDef] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [nodes, setNodes] = useState<ExecNode[]>([]);
  const [root, setRoot] = useState<ExecNode | null>(null);
  const [totalCost, setTotalCost] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const idMap = useMemo(() => {
    const map = new Map<string, ExecNode>();
    for (const n of nodes) map.set(n.id, n);
    return map;
  }, [nodes]);

  const selectedNode = selectedId ? idMap.get(selectedId) ?? null : null;

  const analyze = () => {
    try {
      const parsed = JSON.parse(input) as ExplainJSON;
      const { root, nodes, totalCost } = parseExplainToTree(parsed);
      setRoot(root);
      setNodes(nodes);
      setTotalCost(totalCost);
      setSelectedId(null);
      setGraphDef(buildMermaid(root, nodes, null));
      setAlerts(generateAlerts(parsed, nodes, totalCost));
    } catch (e: unknown) {
      setGraphDef(null);
      setRoot(null);
      setNodes([]);
      setAlerts([{
        type: 'ALERTA',
        code: 'BOTTLENECK',
        severity: 'low',
        message: 'JSON inválido. Verifique o formato.',
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
    selectedId,
    selectedNode,
    analyze,
  };
}