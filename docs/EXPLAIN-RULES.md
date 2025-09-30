# Regras de Análise do EXPLAIN (MySQL 8.4)

Este documento descreve as regras de análise e sugestões usadas pelo projeto para interpretar a saída do `EXPLAIN FORMAT=JSON` do MySQL 8.4, alinhadas à documentação oficial:
- MySQL 8.4 Reference Manual – EXPLAIN: https://dev.mysql.com/doc/refman/8.4/en/explain.html
- Campos do formato JSON (query_block, nested_loop, cost_info, table.* e Extra flags).

Arquivos relevantes:
- Heurísticas (regras e mensagens): [src/lib/explain/heuristics.ts](src/lib/explain/heuristics.ts)
- Tipos e modelo de dados: [src/lib/explain/types.ts](src/lib/explain/types.ts)
- Normalização do JSON para árvore interna: [src/lib/explain/normalize.ts](src/lib/explain/normalize.ts)
- Construção do diagrama do plano: [src/lib/mermaid/buildGraph.ts](src/lib/mermaid/buildGraph.ts)

---

## 1) Escopo e Modelo de Dados

- Entrada: JSON completo do `EXPLAIN FORMAT=JSON` do MySQL 8.4.
- O normalizador converte o JSON nativo em nós internos (`ExecNode`) com:
  - `accessType`, `table`, `cost`, `rowsExamined`, `rowsProduced`, `raw`, `children`.
- Fontes dos valores:
  - `accessType` ⇢ `table.access_type`
  - `rowsExamined` ⇢ `table.rows_examined_per_scan`
  - `rowsProduced` ⇢ `table.rows_produced_per_join`
  - `cost` ⇢ `table.cost_info.prefix_cost` (fallback: `query_cost`)
  - Extra flags via `raw` (por exemplo, `using_filesort`, `using_temporary_table`, `using_index`, `using_join_buffer`, `filtered`)

Implementações:
- Normalização: [src/lib/explain/normalize.ts](src/lib/explain/normalize.ts)
- Tipos: [src/lib/explain/types.ts](src/lib/explain/types.ts)

---

## 2) Regras de Alerta e Sugestão

As regras abaixo refletem conceitos e termos da documentação oficial do MySQL 8.4. Severidade e mensagens foram ajustadas para orientar otimizações práticas.

1. FULL TABLE SCAN — access_type = ALL
- Condição: `accessType === 'ALL'` e `rowsExamined > 5000`
- Severidade: high
- Código: `FULL_TABLE_SCAN`
- Base na documentação: `ALL` indica varredura completa da tabela.
- Sugestão: Criar/ajustar índices nas colunas de `WHERE`/`JOIN` com maior seletividade; revisar predicados.

2. FULL INDEX SCAN — access_type = index
- Condição: `accessType === 'INDEX'` e `rowsExamined > 5000`
- Severidade: medium
- Código: `FULL_INDEX_SCAN`
- Base na documentação: `index` varre todas as entradas do índice (leitura completa do índice).
- Sugestão: Predicados mais seletivos; revisar ordem das colunas em índices compostos; reduzir colunas projetadas quando possível.

3. LOW SELECTIVITY — filtered baixo
- Condição: `filtered` presente e < 10%
- Severidade: medium
- Código: `LOW_SELECTIVITY`
- Base na documentação: `filtered` é a porcentagem estimada de linhas que passam aos próximos estágios.
- Sugestão: Melhorar seletividade de filtros e índices para reduzir linhas lidas e descartadas.

4. FILE SORT — Extra: Using filesort
- Condição: `using_filesort === true`
- Severidade: medium
- Código: `FILE_SORT`
- Base na documentação: `Using filesort` indica ordenação em disco.
- Sugestão: Cobrir a cláusula `ORDER BY` com índice apropriado para obter dados já ordenados.

5. TEMPORARY TABLE — Extra: Using temporary
- Condição: `using_temporary_table === true`
- Severidade: medium
- Código: `TEMP_TABLE`
- Base na documentação: `Using temporary` materializa resultados intermediários (comum em `GROUP BY`/`UNION`).
- Sugestão: Reavaliar índices, reescrever consultas e minimizar materializações.

6. JOIN BUFFER — Extra: Using join buffer
- Condição: `using_join_buffer` presente (string/true)
- Severidade: medium
- Código: `JOIN_BUFFER`
- Base na documentação: `Using join buffer` (por exemplo, BNL/BKA/Hash Join) implica ausência/ineficácia de índices de junção.
- Sugestão: Criar/ajustar índices nas colunas usadas para junção; revisar ordem das junções para permitir nested loop indexado.

7. COVERING INDEX — Extra: Using index
- Condição: `using_index === true`
- Severidade: low (informativo)
- Código: `COVERING_INDEX`
- Base na documentação: `Using index` indica que o plano pode ser atendido apenas com dados do índice.
- Sugestão: Sinal positivo; quando possível, projetar índices “covering” para consultas críticas.

8. UNUSED INDEX — `possible_keys` definidos mas `key` não escolhido
- Condição: `possible_keys` não vazio e `key` ausente
- Severidade: low
- Código: `UNUSED_INDEX`
- Base na documentação: `possible_keys` lista candidatos; `key` mostra o índice escolhido pelo otimizador.
- Sugestão: Verificar funções em colunas (`LOWER(...)`, casts), incompatibilidades de tipo/cola, estatísticas e ordem de colunas.

9. BOTTLENECK — nó(s) com maior custo relativo
- Condição: nós com `cost` máximo > 0
- Severidade: high (informativo)
- Código: `BOTTLENECK`
- Base na documentação: custos (prefix/query cost) indicam estimativa de trabalho/recursos.
- Cálculo: percentual = `node.cost / (totalCost || maxCost)`; destaca o maior contribuinte para priorização.

Implementação das regras:
- Heurísticas: [src/lib/explain/heuristics.ts](src/lib/explain/heuristics.ts)
- Enum de códigos: [src/lib/explain/types.ts](src/lib/explain/types.ts)

---

## 3) Limiar e Configuração

- Limiar para FULL TABLE/INDEX SCAN: `rowsExamined > 5000` (heurístico, pode ser adaptado conforme contexto de dados).
- Limiar para LOW SELECTIVITY: `filtered < 10%`.
- Recomendação: Externalizar limiares no futuro (arquivo de configuração) para ajustar por ambiente.

---

## 4) Observações Importantes

- As métricas do EXPLAIN são estimativas (estatísticas do otimizador). Devem ser interpretadas em conjunto com métricas reais (EXPLAIN ANALYZE, quando aplicável).
- Algumas flags e campos podem não estar presentes em todos os nós. As regras são aplicadas de forma oportunista quando a informação está disponível.
- A presença de `Using temporary` e/ou `Using filesort` não é necessariamente um erro, mas um sinal de atenção para custo/escala.

---

## 5) Como o Projeto Aplica as Regras

- O JSON é normalizado em árvore interna: [src/lib/explain/normalize.ts](src/lib/explain/normalize.ts)
- O diagrama é gerado a partir da árvore: [src/lib/mermaid/buildGraph.ts](src/lib/mermaid/buildGraph.ts)
- As heurísticas processam os nós e retornam `Alert[]`: [src/lib/explain/heuristics.ts](src/lib/explain/heuristics.ts)
- A interface lista alertas e destaca o nó selecionado.
