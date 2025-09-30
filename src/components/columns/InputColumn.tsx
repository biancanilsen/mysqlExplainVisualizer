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
    <div className="col-span-12 lg:col-span-3 flex flex-col min-h-0">
      <Card className="h-full flex flex-col border border-gray-700">
        <CardHeader className="pb-2 flex-shrink-0">
          <span className="font-semibold">Análise EXPLAIN</span>
        </CardHeader>
        <CardBody className="flex-1 flex flex-col gap-3 min-h-0">
          {/* Textarea ocupa 50% da coluna */}
          <div className="basis-1/2 min-h-0 flex flex-col">
            <Textarea
              label="EXPLAIN FORMAT=JSON"
              placeholder="Cole aqui o EXPLAIN ANALISE JSON..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="h-full"
              classNames={{ input: "h-full resize-none", inputWrapper: "h-full" }}
              maxRows={15}
            />
          </div>

          {/* Ações */}
          <div className="flex-shrink-0">
            <div className="flex items-center gap-2">
              <Button color="primary" onPress={analyze} size="md" className="w-full mb-2">
                Analisar
              </Button>
            </div>
            <span className="text-sm text-gray-500">Clique em um nó do plano de execução para ver detalhes.</span>
          </div>

          {/* Painel de análise ocupa o restante */}
          <div className="flex-1 min-h-0 flex flex-col">
            <ScrollShadow className="flex-1 w-full">
              <AnalysisPanel alerts={alerts} selectedId={selectedId} variant="bare" />
            </ScrollShadow>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}