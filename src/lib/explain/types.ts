export interface CostInfo {
  query_cost?: string | number
  eval_cost?: string | number
  read_cost?: string | number
  prefix_cost?: string | number
  data_read_per_join?: string
}

export interface TableNode {
  table_name: string
  access_type?: string
  possible_keys?: string[]
  key?: string | null
  used_key_parts?: string[]
  key_length?: string
  ref?: string[]
  rows_examined_per_scan?: number
  rows_produced_per_join?: number
  filtered?: string | number
  cost_info?: CostInfo
  used_columns?: string[]
  attached_condition?: string
  using_filesort?: boolean
  using_temporary_table?: boolean
  nested_loop?: NodeWrapper[]
  // Allow any additional fields MySQL may add
  [key: string]: unknown
}

export interface NodeWrapper {
  table?: TableNode
  nested_loop?: NodeWrapper[]
  [key: string]: unknown
}

export interface QueryBlock {
  select_id: number
  cost_info?: CostInfo
  nested_loop?: NodeWrapper[]
  [key: string]: unknown
}

export interface ExplainJSON {
  query_block: QueryBlock
}

export interface ExecNode {
  id: string
  accessType?: string
  table?: string
  cost: number
  rowsExamined?: number
  rowsProduced?: number
  raw: unknown
  children: ExecNode[]
}

export type AlertType = 'ALERTA' | 'INFORMATIVO'
export type AlertCode =
  | 'FULL_TABLE_SCAN'
  | 'FILE_SORT'
  | 'TEMP_TABLE'
  | 'UNUSED_INDEX'
  | 'BOTTLENECK'

export interface Alert {
  type: AlertType
  code: AlertCode
  message: string
  nodeId?: string
  severity?: 'high' | 'medium' | 'low'
}

export function toNumber(v: string | number | undefined | null, fallback = 0): number {
  if (v == null) return fallback
  if (typeof v === 'number') return isFinite(v) ? v : fallback
  const n = Number.parseFloat(v)
  return Number.isFinite(n) ? n : fallback
}
