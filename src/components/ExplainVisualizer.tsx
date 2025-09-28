// src/components/ExplainVisualizer.tsx
import { useExplainAnalysis } from '../hooks/useExplainAnalysis';
import InputColumn from './columns/InputColumn';
import DiagramColumn from './columns/DiagramColumn';
import DetailsColumn from './columns/DetailsColumn';

export default function ExplainVisualizer() {
  const {
    input,
    setInput,
    graphDef,
    alerts,
    nodes,
    totalCost,
    selectedId,
    selectedNode,
    analyze,
  } = useExplainAnalysis();

  return (
    <div className="dark text-foreground bg-background h-screen flex flex-col overflow-hidden">
      <div className="flex-shrink-0 p-4 border-b border-gray-700">
        <div className="flex items-center justify-between w-full mx-auto">
          <h1 className="text-2xl font-bold">MySQL Explain Visualizer</h1>
          <div className="text-sm text-gray-300">
            Custo total estimado: <span className="font-mono">{totalCost.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="grid grid-cols-12 gap-4 p-4 w-full h-full">
          <InputColumn
            input={input}
            setInput={setInput}
            analyze={analyze}
            alerts={alerts}
            selectedId={selectedId}
          />
          <DiagramColumn graphDef={graphDef} nodes={nodes} />
          <DetailsColumn node={selectedNode} />
        </div>
      </div>
    </div>
  );
}