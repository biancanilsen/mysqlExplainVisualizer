# Documentação da Análise do EXPLAIN (FORMAT=JSON e ANALYZE texto)

Este documento descreve como o projeto processa e analisa a saída do MySQL `EXPLAIN FORMAT=JSON`, desde a leitura do JSON até a visualização e geração de alertas/sugestões de otimização.

- Normalizadores: [ts.parseExplainToTree()](src/lib/explain/normalize.ts:83) e [ts.parseExplainAnalyzeText()](src/lib/explain/parseText.ts:130)
- Construção do diagrama Mermaid: [ts.buildMermaid()](src/lib/mermaid/buildGraph.ts:31)
- Heurísticas de alertas/sugestões: [ts.generateAlerts()](src/lib/explain/heuristics.ts:5)
- Auto-detector e ação de análise: [ts.analyze()](src/hooks/useExplainAnalysis.ts:26)

---

## Visão Geral do Pipeline

1) Entrada: JSON do `EXPLAIN FORMAT=JSON` ou texto do `EXPLAIN ANALYZE` (MySQL).
2) Normalização: conversão em uma árvore de execução (`ExecNode`) com custos e métricas.
   - JSON: [ts.parseExplainToTree()](src/lib/explain/normalize.ts:83)
   - Texto: [ts.parseExplainAnalyzeText()](src/lib/explain/parseText.ts:130)
3) Visualização: geração de um diagrama (Mermaid flowchart) com nós e arestas.
   - [ts.buildMermaid()](src/lib/mermaid/buildGraph.ts:31)
4) Heurísticas: varredura dos nós para gerar alertas/sugestões.
   - [ts.generateAlerts()](src/lib/explain/heuristics.ts:5)
5) UI: exibe o diagrama, a análise e os detalhes do nó selecionado.
   - [tsx.ExplainVisualizer()](src/components/ExplainVisualizer.tsx:66)
   - [tsx.AnalysisPanel()](src/components/AnalysisPanel.tsx:11)
   - [tsx.DetailsPanel()](src/components/DetailsPanel.tsx:18)

---

## Fluxo Detalhado

### 1. Entrada do EXPLAIN

- O usuário pode colar o EXPLAIN ANALYZE (texto) ou o JSON de `EXPLAIN FORMAT=JSON` na coluna de entrada.
- O projeto fornece um exemplo de JSON para testes:
  - Constante: [ts.jsonExample](src/utils/jsonExemple.ts:1)
- Ao clicar em “Analisar”, é executada a função [ts.analyze()](src/hooks/useExplainAnalysis.ts:26):
  - Auto-detecção: se o texto começar com “{” ou “[”, tenta JSON → [ts.parseExplainToTree()](src/lib/explain/normalize.ts:83); caso contrário, usa [ts.parseExplainAnalyzeText()](src/lib/explain/parseText.ts:130).
  - Visualização via [ts.buildMermaid()](src/lib/mermaid/buildGraph.ts:31).
  - Geração de alertas via [ts.generateAlerts()](src/lib/explain/heuristics.ts:5).
  - Atualiza estados da interface (root, nodes, totalCost, selectedId, graphDef, alerts).

Exemplo de EXPLAIN ANALYZE (texto) aceito:
```text
-> Table scan on c (cost=418.35 rows=150)
-> Index lookup on p using fk_pedidos_clientes (cost=1138.35 rows=600)
-> Index lookup on i using fk_itens_pedido (cost=12181.93 rows=1200)
-> Unique index lookup on prod using PRIMARY (cost=12781.93 rows=1200)
```

### 2. Normalização (parseExplainToTree)

- Entrada: [ts.ExplainJSON](src/lib/explain/types.ts:43) contendo `query_block` e possivelmente `nested_loop`.
- Passos (em [ts.parseExplainToTree()](src/lib/explain/normalize.ts:83)):
  - Zera contador de IDs internos.
  - Extrai `totalCost` de `query_block.cost_info.query_cost`.
  - Constrói a árvore a partir de `nested_loop` via [ts.buildFromNestedLoop()](src/lib/explain/normalize.ts:37):
    - Para cada entrada:
      - Se houver `table`, cria um nó de execução com [ts.toExecNodeFromTable()](src/lib/explain/normalize.ts:16):
        - Custo do nó: `prefix_cost` → `query_cost` → 0.
        - Métricas: `rows_examined_per_scan` e `rows_produced_per_join`.
      - Se houver `nested_loop`, processa recursivamente (sub-árvore).
      - Caso contrário, cria um nó genérico (“op”) com custo 0, contendo o wrapper bruto.
    - Encadeamento: cada nó vira “pai” do anterior (ordem do pipeline de execução).
  - Coleta todos os nós via BFS com [ts.collectNodes()](src/lib/explain/normalize.ts:71).
  - Ajusta o custo da raiz para refletir `totalCost` se este for maior.
  - Define `totalCost` efetivo: `query_cost` do bloco, ou o maior custo entre os nós como fallback.

- Estruturas envolvidas:
  - ExecNode: [ts.ExecNode](src/lib/explain/types.ts:47)
  - TableNode: [ts.TableNode](src/lib/explain/types.ts:9)
  - NodeWrapper: [ts.NodeWrapper](src/lib/explain/types.ts:30)
  - Conversão numérica robusta: [ts.toNumber()](src/lib/explain/types.ts:74)

### 3. Visualização (buildMermaid)

- A função [ts.buildMermaid()](src/lib/mermaid/buildGraph.ts:31) gera um `flowchart TD` (top-down).
- Cada ExecNode vira um nó Mermaid com rótulo composto por:
  - Operação traduzida: [ts.humanAccess()](src/lib/mermaid/buildGraph.ts:3)
  - Tabela (quando houver)
  - Custo (duas casas decimais)
  - Linhas lidas e produzidas
  - Composição do texto: [ts.generateNodeText()](src/lib/mermaid/buildGraph.ts:17)
- Arestas: `pai -- "rowsProduced | rowsExamined | ?" --> filho`.
- Classes visuais por custo:
  - `hot` para custo máximo entre os nós.
  - `warm` para custo ≥ 25% do máximo.
  - `cool` para os demais.
- Seleção de nó:
  - Classe adicional `selected` ao nó atualmente selecionado.
  - Cliques disparam `window.__onMermaidNodeClick(id)`, definido em [tsx.ExplainVisualizer()](src/components/ExplainVisualizer.tsx:92).
- Tooltips (SVG title) com custo e métricas são inseridos após a renderização do Mermaid em [tsx.ExplainVisualizer()](src/components/ExplainVisualizer.tsx:118).

### 4. Heurísticas e Regras de Sugestão (generateAlerts)

- Implementação: [ts.generateAlerts()](src/lib/explain/heuristics.ts:1)
- Retorna: `Alert[]` com tipo, código, mensagem, severidade e `nodeId` (quando aplicável).
- As regras abaixo foram alinhadas aos conceitos oficiais do MySQL 8.4 (EXPLAIN / access_type, Extra flags e métricas como `filtered`).

1) FULL TABLE SCAN — access_type = ALL
- Condição: `accessType === 'ALL'` e `rowsExamined > 5000`.
- Severidade: `high`.
- Código: `FULL_TABLE_SCAN`.
- Mensagem: leitura completa da tabela. A doc define `ALL` como varredura total; recomenda-se criar/ajustar índices para predicados de `WHERE`/`JOIN` com maior seletividade.
- Trecho: [src/lib/explain/heuristics.ts](src/lib/explain/heuristics.ts)

2) FULL INDEX SCAN — access_type = index
- Condição: `accessType === 'INDEX'` e `rowsExamined > 5000`.
- Severidade: `medium`.
- Código: `FULL_INDEX_SCAN`.
- Mensagem: varredura completa do índice; avalie predicados mais seletivos e a ordem das colunas em índices compostos.
- Trecho: [src/lib/explain/heuristics.ts](src/lib/explain/heuristics.ts)

3) LOW SELECTIVITY — filtered baixo
- Condição: `filtered` presente e < 10%.
- Severidade: `medium`.
- Código: `LOW_SELECTIVITY`.
- Mensagem: baixa seletividade estimada; muitas linhas lidas são descartadas. Otimize predicados e índices.
- Trecho: [src/lib/explain/heuristics.ts](src/lib/explain/heuristics.ts)

4) FILE SORT — Extra: Using filesort
- Condição: `using_filesort === true`.
- Severidade: `medium`.
- Código: `FILE_SORT`.
- Mensagem: operação de ordenação em disco; prefira cobrir a cláusula `ORDER BY` com índice.
- Trecho: [src/lib/explain/heuristics.ts](src/lib/explain/heuristics.ts)

5) TEMPORARY TABLE — Extra: Using temporary
- Condição: `using_temporary_table === true`.
- Severidade: `medium`.
- Código: `TEMP_TABLE`.
- Mensagem: materialização em tabela temporária; comum em `GROUP BY`/`UNION`. Revise índices e reescritas para reduzir materializações.
- Trecho: [src/lib/explain/heuristics.ts](src/lib/explain/heuristics.ts)

6) JOIN BUFFER — Extra: Using join buffer
- Condição: `using_join_buffer` presente (string/true).
- Severidade: `medium`.
- Código: `JOIN_BUFFER`.
- Mensagem: uso de join buffer (BNL/BKA/Hash Join) indica ausência de índice efetivo para a junção; crie/ajuste índices nas colunas de JOIN e reavalie a ordem das junções.
- Trecho: [src/lib/explain/heuristics.ts](src/lib/explain/heuristics.ts)

7) COVERING INDEX — Extra: Using index
- Condição: `using_index === true`.
- Severidade: `low` (informativo).
- Código: `COVERING_INDEX`.
- Mensagem: plano atendido apenas pelo índice (covering), reduzindo I/O em tabela.
- Trecho: [src/lib/explain/heuristics.ts](src/lib/explain/heuristics.ts)

8) UNUSED INDEX — possible_keys presentes, key não escolhido
- Condição: `possible_keys` não vazio e `key` ausente.
- Severidade: `low`.
- Código: `UNUSED_INDEX`.
- Mensagem: índices candidatos não utilizados; verifique funções nas colunas, tipos/colations, estatísticas e ordem de colunas.
- Trecho: [src/lib/explain/heuristics.ts](src/lib/explain/heuristics.ts)

9) BOTTLENECK — nó(s) com maior custo relativo
- Cálculo: `maxCost = max(n.cost)`, `denom = totalCost || maxCost || 1`.
- Condição: nós com `cost === maxCost` e `maxCost > 0`.
- Severidade: `high` (informativo).
- Código: `BOTTLENECK`.
- Mensagem: identifica o principal gargalo com percentual do custo total do plano.
- Trecho: [src/lib/explain/heuristics.ts](src/lib/explain/heuristics.ts)

### 5. Interface e Interação

- Componente raiz: [tsx.ExplainVisualizer()](src/components/ExplainVisualizer.tsx:66)
- Ação de análise: [tsx.analyze()](src/components/ExplainVisualizer.tsx:152)
- Diagrama:
  - Renderizado dinamicamente após `graphDef` mudar.
  - Clique em nós define `selectedId` via handler global [tsx.ExplainVisualizer()](src/components/ExplainVisualizer.tsx:92).
- Painel de Análise:
  - Lista alertas e destaca os do nó selecionado: [tsx.AnalysisPanel()](src/components/AnalysisPanel.tsx:11)
- Painel de Detalhes:
  - Exibe atributos do nó (tipo de acesso, custo, linhas) e JSON bruto do nó: [tsx.DetailsPanel()](src/components/DetailsPanel.tsx:18)

---

## Tipos e Modelo de Dados

- JSON de entrada: [ts.ExplainJSON](src/lib/explain/types.ts:43)
  - `query_block`: [ts.QueryBlock](src/lib/explain/types.ts:36)
  - `nested_loop`: [ts.NodeWrapper](src/lib/explain/types.ts:30)
- Nós de tabela: [ts.TableNode](src/lib/explain/types.ts:9)
  - Principais campos:
    - `table_name`, `access_type`, `possible_keys`, `key`, `used_key_parts`
    - `rows_examined_per_scan`, `rows_produced_per_join`
    - `cost_info` ([ts.CostInfo](src/lib/explain/types.ts:1))
    - `using_filesort`, `using_temporary_table`
- Nós de execução: [ts.ExecNode](src/lib/explain/types.ts:47)
  - `id`, `accessType`, `table`, `cost`, `rowsExamined`, `rowsProduced`, `raw`, `children`
- Alertas:
  - Tipo: [ts.Alert](src/lib/explain/types.ts:66)
  - Códigos: [ts.AlertCode](src/lib/explain/types.ts:59)

---

## Limitações e Considerações

- Limiar do FULL TABLE SCAN: fixo em `rowsExamined > 5000`.
  - Possível futuro: tornar configurável (ex.: por arquivo de config).
- A regra `UNUSED_INDEX` indica “potencial” subutilização; não implica índice “sobrando”.
- Os custos e métricas são relativos ao plano e estatísticas do momento do EXPLAIN.
- Nós “genéricos” (sem `table` ou sem mapeamento explícito) recebem custo 0 e servem para manter a estrutura do pipeline.

---

## Extensões Futuras Sugeridas

- Heurística de baixa seletividade (`filtered` pequeno).
- Heurística de “covering index” (quando `used_columns` ⊆ colunas do índice em uso).
- Sinalização de cardinalidades anômalas entre nós (produção de linhas muito alta).
- Alerta para `data_read_per_join` elevado.
- Sugestões baseadas em `attached_condition` para apontar colunas candidatas a índices.

---

## Exemplo de Fluxo (Mermaid)

```mermaid
flowchart TD
  A[EXPLAIN FORMAT=JSON] --> B[parseExplainToTree]
  B --> C[ExecNode[] e raiz]
  C -->|buildMermaid| D[Definição Mermaid]
  C -->|generateAlerts| E[Alertas[]]
  D --> F[Render do Diagrama]
  E --> G[Análise e Sugestões]
  F --> H[Cliques do Usuário (selectedId)]
  H --> F
```

---

## Como Usar no Projeto

1) Cole o JSON do `EXPLAIN FORMAT=JSON` no painel “EXPLAIN FORMAT=JSON”.
2) Clique em “Analisar” para processar:
   - Normalização → Diagrama → Alertas.
3) Interaja com o diagrama:
   - Clique em um nó para ver detalhes e destacar alertas relacionados.
4) Interprete os alertas na aba de análise:
   - Priorize `high`, depois `medium`, e por fim `low`.
5) Verifique o nó com maior custo (classes visuais “hot/warm/cool”) e avalie possíveis otimizações.

---

## Referências de Código

- Normalização:
  - [ts.parseExplainToTree()](src/lib/explain/normalize.ts:83)
  - [ts.toExecNodeFromTable()](src/lib/explain/normalize.ts:16)
  - [ts.buildFromNestedLoop()](src/lib/explain/normalize.ts:37)
  - [ts.collectNodes()](src/lib/explain/normalize.ts:71)
- Visualização:
  - [ts.buildMermaid()](src/lib/mermaid/buildGraph.ts:31)
  - [ts.generateNodeText()](src/lib/mermaid/buildGraph.ts:17)
  - [ts.humanAccess()](src/lib/mermaid/buildGraph.ts:3)
- Heurísticas:
  - [ts.generateAlerts()](src/lib/explain/heuristics.ts:4)
- Tipos:
  - [ts.ExplainJSON](src/lib/explain/types.ts:43)
  - [ts.ExecNode](src/lib/explain/types.ts:47)
  - [ts.Alert](src/lib/explain/types.ts:66)
  - [ts.AlertCode](src/lib/explain/types.ts:59)
- UI:
  - [tsx.ExplainVisualizer()](src/components/ExplainVisualizer.tsx:66)
  - [tsx.analyze()](src/components/ExplainVisualizer.tsx:152)
  - [tsx.AnalysisPanel()](src/components/AnalysisPanel.tsx:11)
  - [tsx.DetailsPanel()](src/components/DetailsPanel.tsx:18)