# MySQL Explain Visualizer

Visualizador interativo para EXPLAIN FORMAT=JSON do MySQL 8.4. Cole o JSON do plano, visualize o pipeline em um diagrama Mermaid, inspecione detalhes por nó e receba análises e sugestões fundamentadas na documentação oficial do MySQL.

Tecnologias: React 19, HeroUI/NextUI, Mermaid 11, TailwindCSS.

- Código-chave: [ts.parseExplainToTree()](src/lib/explain/normalize.ts:83), [ts.buildMermaid()](src/lib/mermaid/buildGraph.ts:31), [ts.generateAlerts()](src/lib/explain/heuristics.ts:4), [ts.ExecNode](src/lib/explain/types.ts:47)

## Sumário
- Visão Geral
- Escopo e Suporte
- Requisitos
- Instalação e Execução
- Como Usar
- Como Funciona (pipeline)
- Regras de Heurísticas (resumo)
- Estrutura do Projeto
- Scripts NPM
- Customização
- Roadmap
- Contribuição
- Licença
- Referências

## Visão Geral
O projeto transforma a saída do MySQL EXPLAIN FORMAT=JSON em uma visualização clara do plano de execução. Ele:
- Gera um diagrama vertical (top-down) com Mermaid, com nós coloridos por custo relativo.
- Exibe métricas por nó: custo, linhas lidas e produzidas.
- Permite clicar nos nós para ver detalhes e destaque correspondente na lista de análises.
- Produz alertas e sugestões baseados na documentação oficial do MySQL 8.4.

Colunas da interface:
- Entrada: textarea para colar o JSON e botão “Analisar”.
- Plano de Execução: diagrama Mermaid com cartões arredondados e setas brancas.
- Detalhes do Nó: informações do nó, JSON bruto e CTA “Experimente o agente de SQL”.

## Escopo e Suporte
- Suportado: MySQL 8.4 (EXPLAIN FORMAT=JSON).
- Não suportado diretamente (exige adaptadores): PostgreSQL, SQL Server, Oracle, etc.
  - Possível no futuro via normalizadores específicos que convertam o formato nativo para [ts.ExecNode](src/lib/explain/types.ts:47).

## Requisitos
- Node.js LTS (>= 18)
- npm (ou yarn/pnpm)

## Instalação e Execução
```bash
npm install
npm start
```
A aplicação roda em http://localhost:3000.

Build de produção:
```bash
npm run build
```

## Como Usar
1) No painel “EXPLAIN FORMAT=JSON”, cole o JSON completo do EXPLAIN (MySQL 8.4).  
2) Clique em “Analisar”.  
3) Explore o diagrama e clique em nós para ver detalhes e alertas relacionados.

Observação: os valores nos rótulos das arestas representam o volume estimado de linhas que flui entre operadores (Linhas Produzidas; fallback para Linhas Lidas).

## Como Funciona (pipeline)
- Normalização: [ts.parseExplainToTree()](src/lib/explain/normalize.ts:83) converte o JSON do MySQL para o modelo interno [ts.ExecNode](src/lib/explain/types.ts:47).
- Diagrama: [ts.buildMermaid()](src/lib/mermaid/buildGraph.ts:31) monta a definição Mermaid com classes visuais por custo. O rótulo do nó é montado por [ts.generateNodeText()](src/lib/mermaid/buildGraph.ts:17) e tipos de acesso traduzidos por [ts.humanAccess()](src/lib/mermaid/buildGraph.ts:3).
- Heurísticas: [ts.generateAlerts()](src/lib/explain/heuristics.ts:4) percorre os nós e retorna sugestões/alertas com severidade e código.
- UI e estado: [tsx.ExplainVisualizer()](src/components/ExplainVisualizer.tsx:7) organiza as colunas e estados; o clique no diagrama atualiza o nó selecionado.

Documentação técnica do pipeline: [docs/EXPLAIN-ANALYSIS.md](docs/EXPLAIN-ANALYSIS.md)

## Regras de Heurísticas (resumo)
As regras abaixo são derivadas da documentação oficial do MySQL 8.4 (EXPLAIN). Os limiares adotados são práticos e podem ser ajustados em [ts.generateAlerts()](src/lib/explain/heuristics.ts:4). A versão detalhada está em [docs/EXPLAIN-RULES.md](docs/EXPLAIN-RULES.md).

- FULL_TABLE_SCAN — access_type = ALL; muitas linhas examinadas
  - Severidade: alta
  - Ação: criar/ajustar índices para predicados de WHERE/JOIN; garantir seletividade.
- FULL_INDEX_SCAN — access_type = index (varredura completa do índice)
  - Severidade: média
  - Ação: melhorar predicados; revisar ordem de colunas em índices compostos; reduzir colunas projetadas quando possível.
- LOW_SELECTIVITY — filtered baixo (< 10%)
  - Severidade: média
  - Ação: melhorar seletividade de filtros e índices para reduzir linhas lidas/descartadas.
- FILE_SORT — Using filesort
  - Severidade: média
  - Ação: cobrir ORDER BY com índice apropriado, evitando ordenação em disco.
- TEMPORARY_TABLE — Using temporary
  - Severidade: média
  - Ação: comum em GROUP BY/UNION; revisar índices e reescritas para minimizar materializações.
- JOIN_BUFFER — Using join buffer
  - Severidade: média
  - Ação: criar/ajustar índices nas colunas de junção; reavaliar ordem de joins.
- COVERING_INDEX — Using index (informativo)
  - Severidade: baixa
  - Ação: positivo; quando possível, projetar índices “covering” para consultas críticas.
- UNUSED_INDEX — possible_keys definidos mas key não escolhido
  - Severidade: baixa
  - Ação: verificar funções em colunas, tipos/colations, estatísticas e ordem de colunas.
- BOTTLENECK — nó(s) com maior custo relativo
  - Severidade: alta (informativo)
  - Ação: priorizar otimizações no maior contribuinte de custo.

Mais detalhes (condições e mensagens completas): [docs/EXPLAIN-RULES.md](docs/EXPLAIN-RULES.md)

## Estrutura do Projeto
- Visualização: [ts.buildMermaid()](src/lib/mermaid/buildGraph.ts:31)
- Normalização: [ts.parseExplainToTree()](src/lib/explain/normalize.ts:83)
- Heurísticas: [ts.generateAlerts()](src/lib/explain/heuristics.ts:4)
- Tipos: [ts.ExplainJSON](src/lib/explain/types.ts:43), [ts.ExecNode](src/lib/explain/types.ts:47)
- Componentes principais:
  - Colunas: [tsx.InputColumn()](src/components/columns/InputColumn.tsx:13), [tsx.DiagramColumn()](src/components/columns/DiagramColumn.tsx:12), [tsx.DetailsColumn()](src/components/columns/DetailsColumn.tsx:10)
  - Painéis: [tsx.AnalysisPanel()](src/components/AnalysisPanel.tsx:11), [tsx.DetailsPanel()](src/components/DetailsPanel.tsx:18)

## Scripts NPM
- start: inicia o servidor de desenvolvimento
- build: gera o build de produção
- test: executa a suíte de testes (quando houver)

## Customização
- Limiar das regras
  - Ajuste diretamente em [ts.generateAlerts()](src/lib/explain/heuristics.ts:4).
- Aparência do diagrama
  - CSS em [src/index.css](src/index.css) controla cantos arredondados dos nós e cor das setas/ponteiros.
- Tradução/labels de operações
  - Em [ts.humanAccess()](src/lib/mermaid/buildGraph.ts:3).

## Roadmap
- Adaptadores para outros SGBDs (ex.: PostgreSQL EXPLAIN JSON).
- Configuração externa dos limiares de heurística.
- Novas heurísticas (covering index avançado, cardinalidades anômalas, etc.).

## Contribuição
Pull Requests são bem-vindos. Recomendações:
- Abrir issue descrevendo motivação/escopo.
- Adicionar testes (quando aplicável) e atualizar documentação.
- Seguir o estilo do projeto (Tailwind e componentes HeroUI).

## Licença
Este projeto não define uma licença específica. Caso necessário, adicione uma licença em LICENSE.

## Referências
- Documentação do MySQL 8.4 — EXPLAIN: https://dev.mysql.com/doc/refman/8.4/en/explain.html
- Mermaid: https://mermaid.js.org/
- HeroUI/NextUI: https://www.heroui.com/
- TailwindCSS: https://tailwindcss.com/
