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
          <span className="font-medium text-gray-200">EXPLAIN FORMAT=JSON</span>
        </CardHeader>
        <CardBody className="flex-1 flex flex-col gap-3 min-h-0">
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            <Textarea
              placeholder="Cole aqui o JSON..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1"
              classNames={{ input: "h-full resize-none", inputWrapper: "h-full" }}
            />
            <div className="flex-shrink-0">
            <div className="flex items-center gap-2">
                {/* MUDANÇA AQUI: Adicionamos a classe flex-1 */}
                <Button color="primary" onPress={analyze} size="md" className="flex-1">
                Analisar
                </Button>
            </div>
                <span className="text-sm text-gray-500">Clique em um nó para ver detalhes.</span>
            </div>
          </div>
          <div className="flex-1 flex flex-col min-h-0">
            <ScrollShadow className="flex-1 w-full">
              <AnalysisPanel alerts={alerts} selectedId={selectedId} variant="bare" />
            </ScrollShadow>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}