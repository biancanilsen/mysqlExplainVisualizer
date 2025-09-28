// src/components/columns/DetailsColumn.tsx
import { Card, CardBody, CardHeader, ScrollShadow } from '@heroui/react';
import DetailsPanel from '../DetailsPanel';
import { ExecNode } from '../../lib/explain/types';

interface DetailsColumnProps {
  node: ExecNode | null;
}

export default function DetailsColumn({ node }: DetailsColumnProps) {
  return (
    <div className="col-span-12 lg:col-span-3 flex flex-col min-h-0">
        <DetailsPanel node={node} />
    </div>
  );
}