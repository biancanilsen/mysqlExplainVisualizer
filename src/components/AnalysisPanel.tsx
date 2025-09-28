import type { ReactNode } from 'react'
import type { Alert } from '../lib/explain/types'
import { Card, CardHeader, CardBody } from '@heroui/react'

type Props = {
  alerts: Alert[]
  selectedId?: string | null
  variant?: 'standalone' | 'bare'
}

export default function AnalysisPanel({ alerts, selectedId, variant = 'standalone' }: Props) {
  const wrap = (children: ReactNode, title = 'Análise e Sugestões') =>
    variant === 'standalone' ? (
      <Card shadow="sm" radius="sm" className="border border-gray-200 dark:border-gray-700">
        <CardHeader className="pb-0">
          <h3 className="font-semibold">{title}</h3>
        </CardHeader>
        <CardBody className="pt-3">{children}</CardBody>
      </Card>
    ) : (
      <>
        <h3 className="font-semibold mb-2">{title}</h3>
        {children}
      </>
    )

  if (!alerts || alerts.length === 0) {
    return wrap(
      <p className="text-sm text-gray-600 dark:text-gray-300">
        Nenhum alerta encontrado para o plano atual.
      </p>,
      'Análise'
    )
  }

  const badge = (a: Alert) => {
    const color =
      a.severity === 'high'
        ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
        : a.severity === 'medium'
        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200'
        : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
    return (
      <span className={`text-xs px-2 py-0.5 rounded ${color}`}>
        {a.type}
      </span>
    )
  }

  return wrap(
    <ul className="space-y-3">
      {alerts.map((a, idx) => {
        const highlighted = a.nodeId && selectedId && a.nodeId === selectedId
        return (
          <li
            key={idx}
            className={[
              'text-sm leading-5 p-2 rounded',
              highlighted ? 'ring-2 ring-blue-500 border border-blue-300 bg-blue-50 dark:bg-blue-950/30' : ''
            ].join(' ').trim()}
          >
            <div className="flex items-start gap-2">
              {badge(a)}
              <p>{a.message}</p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}