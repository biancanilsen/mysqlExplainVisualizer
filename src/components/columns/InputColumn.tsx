import { Button, Card, CardBody, CardHeader, ScrollShadow, Textarea } from '@heroui/react';
import AnalysisPanel from '../AnalysisPanel';
import { Alert } from '../../lib/explain/types';

interface InputColumnProps {
  input: string;
  setInput: (value: string) => void;
  analyze: () => void;
  alerts: Alert[];
  selectedId: string | null;
}

export default function InputColumn({ input, setInput, analyze, alerts, selectedId }: InputColumnProps) {
  return (
    <div className="col-span-12 lg:col-span-3 flex flex-col min-h-0 h-full">
      <Card className="h-full min-h-0 flex flex-col overflow-hidden border border-gray-700">
        <CardHeader className="pb-2 flex-shrink-0">
          <span className="font-semibold">Análise EXPLAIN</span>
        </CardHeader>
        <CardBody className="flex-1 min-h-0 grid grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-3 overflow-hidden">
          {/* Textarea ocupa 50% da coluna */}
          <div className="min-h-0 flex flex-col overflow-hidden">
            <div className="text-xs font-semibold mb-1">EXPLAIN FORMAT=JSON</div>
            <div className="flex-1 min-h-0">
              <Textarea
                aria-label="EXPLAIN FORMAT=JSON"
                placeholder="Cole aqui o EXPLAIN ANALISE JSON..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disableAutosize
                className="h-full fill-vert-textarea"
                classNames={{
                  base: "h-full",
                  inputWrapper: "h-full",
                  innerWrapper: "h-full",
                  input: "h-full resize-none"
                }}
              />
            </div>
          </div>

          {/* 50% restante: Ações + Painel de análise */}
          <div className="min-h-0 flex flex-col gap-3 overflow-hidden">
            {/* Ações */}
            <div className="flex-shrink-0">
              <div className="flex items-center gap-2">
                <Button color="primary" onPress={analyze} size="md" className="w-full mb-2">
                  Analisar
                </Button>
              </div>
              <span className="text-sm text-gray-500">Clique em um nó do plano de execução para ver detalhes.</span>
            </div>

            {/* Painel de análise ocupa o restante da metade inferior */}
            <div className="flex-1 min-h-0 flex flex-col">
              <ScrollShadow className="flex-1 w-full">
                <AnalysisPanel alerts={alerts} selectedId={selectedId} variant="bare" />
              </ScrollShadow>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}