// src/components/columns/DiagramColumn.tsx
import { Card, CardBody, CardHeader, ScrollShadow } from '@heroui/react';
import { useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import { ExecNode } from '../../lib/explain/types';

interface DiagramColumnProps {
  graphDef: string | null;
  nodes: ExecNode[];
}

export default function DiagramColumn({ graphDef, nodes }: DiagramColumnProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!graphDef || !containerRef.current) return;
    let cancelled = false;

    // Helper: encontra o contêiner com overflow scroll/auto para preservar/restaurar o scroll
    const findScrollContainer = (node: HTMLElement | null): HTMLElement | null => {
      let cur = node?.parentElement;
      while (cur) {
        const style = getComputedStyle(cur);
        const oy = style.overflowY;
        if (oy === 'auto' || oy === 'scroll') return cur;
        cur = cur.parentElement as HTMLElement | null;
      }
      return null;
    };

    (async () => {
      const el = containerRef.current!;
      const scroller = findScrollContainer(el);
      const prevTop = scroller?.scrollTop ?? 0;
      const prevLeft = scroller?.scrollLeft ?? 0;

      el.innerHTML = '';
      try {
        const { svg, bindFunctions } = await mermaid.render(`graph-${Date.now()}`, graphDef);
        if (!cancelled) {
          el.innerHTML = svg;
          bindFunctions?.(el);

          // Restaura a posição de scroll após o re-render do SVG
          if (scroller) {
            requestAnimationFrame(() => {
              if (!cancelled) {
                scroller.scrollTop = prevTop;
                scroller.scrollLeft = prevLeft;
              }
            });
          }
        }
      } catch (e) {
        el.innerHTML = '<div class="text-red-600">Falha ao renderizar.</div>';
        console.error(e);
      }
    })();
    return () => { cancelled = true; };
  }, [graphDef, nodes]);

  return (
    <div className="col-span-12 lg:col-span-6 flex flex-col min-h-0">
      <Card className="h-full flex flex-col border border-gray-700">
        <CardHeader className="pb-2 flex-shrink-0">
          <div className="font-semibold">Plano de Execução</div>
        </CardHeader>
        <CardBody className="flex-1 min-h-0">
          <ScrollShadow className="h-full w-full">
            <div ref={containerRef} className="mermaid-container flex justify-center rounded-xl" />
          </ScrollShadow>
        </CardBody>
      </Card>
    </div>
  );
}