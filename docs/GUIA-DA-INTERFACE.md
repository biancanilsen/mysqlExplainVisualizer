# Guia da Interface — MySQL Explain Visualizer

Este guia descreve cada elemento da tela, seu propósito, de onde vem a informação e como interpretar os dados exibidos. Onde relevante, há links diretos para o código-fonte responsável por gerar cada parte.

Arquitetura-base da tela: [tsx.ExplainVisualizer()](src/components/ExplainVisualizer.tsx:7)

Sumário
- Barra superior
- Coluna 1 — Análise EXPLAIN
  - 1.1 TextArea “EXPLAIN FORMAT=JSON” (entrada do plano)
  - 1.2 Ações (botão Analisar e ajuda)
  - 1.3 Lista “Análise e Sugestões”
- Coluna 2 — Plano de Execução (diagrama Mermaid)
  - 2.1 Cartões dos nós (o que aparece e como é montado)
  - 2.2 Arestas (setas) e o número acima da seta
  - 2.3 Cores dos nós (hot / warm / cool) e nó selecionado
  - 2.4 Clique nos nós e sincronização com os detalhes
  - 2.5 Aparência (bordas arredondadas, setas brancas)
- Coluna 3 — Detalhes do Nó
  - 3.1 Badges do nó (FULL SCAN, FILESORT, TEMP TABLE)
  - 3.2 Informações principais
  - 3.3 JSON Bruto (área central expansível)
  - 3.4 Ação: “Experimente o agente de SQL”
- Interações globais e comportamento
- Responsividade e proporções
- Mensagens de erro
- Glossário rápido (tipos de acesso)
- Mapeamento de código

---

## Barra superior

- Título: “MySQL Explain Visualizer”.
- Custo total estimado: valor exibido à direita, calculado após a análise.
  - Renderização: [tsx.ExplainVisualizer()](src/components/ExplainVisualizer.tsx:25)
  - Cálculo base: totalCost vem do normalizador do EXPLAIN e considera query_cost/prefix_cost (detalhe em “Como funciona” na documentação técnica).

---

## Coluna 1 — Análise EXPLAIN

Controlador: [tsx.InputColumn()](src/components/columns/InputColumn.tsx:13)

### 1.1 TextArea “EXPLAIN FORMAT=JSON” (entrada do plano)
- O que é: campo para colar o JSON completo retornado por “EXPLAIN FORMAT=JSON” do MySQL 8.4.
- Onde fica: parte superior da coluna de Análise EXPLAIN.
- Tamanho: ocupa exatamente 50% da altura do card (metade superior).
- Comportamento:
  - Preenche 100% da altura disponível do contêiner (autosize desativado e wrappers ajustados).
  - Regras utilitárias de CSS garantem o preenchimento vertical:
    - Classe utilitária: [src/index.css](src/index.css)
  - Código do TextArea: [tsx.InputColumn()](src/components/columns/InputColumn.tsx:25)

### 1.2 Ações (botão Analisar e ajuda)
- Botão “Analisar”: dispara o pipeline de análise (parse → mermaid → heurísticas).
  - Handler: [tsx.useExplainAnalysis().analyze](src/hooks/useExplainAnalysis.ts:26)
- Texto auxiliar: “Clique em um nó do plano de execução para ver detalhes.”

### 1.3 Lista “Análise e Sugestões”
- Conteúdo: cards com alertas e sugestões gerados por heurísticas alinhadas à documentação do MySQL 8.4.
- Estrutura visual:
  - “Tag” fixa na primeira coluna do card (largura padronizada), alinhada vertical e horizontalmente.
  - Mensagem detalhada na segunda coluna.
  - Código do layout: [tsx.AnalysisPanel()](src/components/AnalysisPanel.tsx:50)
- Severidade e cores da tag:
  - Alta: vermelho
  - Média: amarelo
  - Baixa/Informativa: cinza
  - Mapeamento: [tsx.AnalysisPanel() badge](src/components/AnalysisPanel.tsx:36)
- Destaque por seleção:
  - Quando um nó do diagrama é selecionado, cards associados a esse nó podem receber destaque (borda/anel).
  - Renderização do destaque: [tsx.AnalysisPanel()](src/components/AnalysisPanel.tsx:53)

---

## Coluna 2 — Plano de Execução (diagrama Mermaid)

Controlador: [tsx.DiagramColumn()](src/components/columns/DiagramColumn.tsx:12)

O diagrama é gerado dinamicamente a partir da definição Mermaid construída pelo código, então cada elemento na tela tem um ponto de origem no JSON de entrada.

### 2.1 Cartões dos nós (o que aparece e como é montado)
- Cada nó representa uma operação do plano: leitura de tabela, join, varredura por índice, etc.
- Título do cartão:
  - Tipo de acesso: traduzido para português por [ts.humanAccess()](src/lib/mermaid/buildGraph.ts:3)
    - Ex.: ALL → “Leitura Completa”, eq_ref → “Busca por Índice (Única)”, etc.
  - Tabela: quando existir, aparece entre crases (`tabela`).
- Linhas do cartão:
  - Custo: custo estimado do nó (duas casas decimais).
  - Linhas Lidas: rows_examined_per_scan (quando disponível).
  - Linhas Produzidas: rows_produced_per_join (quando disponível).
- Montagem do texto do nó (label HTML):
  - Função: [ts.generateNodeText()](src/lib/mermaid/buildGraph.ts:17)
  - A função compõe o título e métricas, escapando aspas e usando quebras de linha HTML.
- Construção do grafo (linhas Mermaid):
  - Função principal: [ts.buildMermaid()](src/lib/mermaid/buildGraph.ts:31)

### 2.2 Arestas (setas) e o número acima da seta
- O que é o número:
  - É o volume de linhas estimado que flui do nó pai para o nó filho na etapa seguinte do plano.
  - Regra de preenchimento:
    - Primeiro tenta usar “Linhas Produzidas” do nó filho (rows_produced_per_join).
    - Se não existir, usa “Linhas Lidas” do nó filho (rows_examined_per_scan).
    - Se ambas ausentes, mostra “?”.
- Onde isso é montado no código:
  - Definição do rótulo da aresta: [edgeLabel](src/lib/mermaid/buildGraph.ts:62)
  - Exemplo da linha Mermaid gerada: `A -- "1200" --> B`
- Como interpretar no contexto do EXPLAIN:
  - É uma estimativa do otimizador baseada em estatísticas (não é contagem real de execução).
  - Serve para entender a redução (ou expansão) de cardinalidade ao longo do pipeline.

### 2.3 Cores dos nós (hot / warm / cool) e nó selecionado
- Classes:
  - hot: nó de maior custo.
  - warm: custo ≥ 25% do custo máximo.
  - cool: demais nós.
  - selected: nó destacado ao ser clicado.
- Onde é definido:
  - Cálculo do custo máximo e classes: [ts.buildMermaid()](src/lib/mermaid/buildGraph.ts:46)
  - Definição visual (fill/stroke): [ts.buildMermaid()](src/lib/mermaid/buildGraph.ts:68)

### 2.4 Clique nos nós e sincronização com os detalhes
- Cada nó tem um handler de clique que chama uma função global.
- Onde é definido:
  - Evento de clique: [ts.buildMermaid()](src/lib/mermaid/buildGraph.ts:85)
  - Registro do handler global: [tsx.useExplainAnalysis()](src/hooks/useExplainAnalysis.ts:58)
- Efeito do clique:
  - Define o nó selecionado (selectedId).
  - Re-renderiza o diagrama com a classe selected aplicada ao nó.
  - Atualiza a Coluna 3 (Detalhes do Nó).
  - Destaca cards relacionados na Coluna 1 (Análise).

### 2.5 Aparência (bordas arredondadas, setas brancas)
- Bordas dos cartões (nós) com raio 32px e setas/brilhos brancos:
  - CSS aplicado ao SVG do Mermaid para nós e marker das setas:
  - Regras: [src/index.css](src/index.css)
- Container do SVG:
  - Renderização e binding de funções: [tsx.DiagramColumn()](src/components/columns/DiagramColumn.tsx:22)

---

## Coluna 3 — Detalhes do Nó

Controladores
- Wrapper da coluna: [tsx.DetailsColumn()](src/components/columns/DetailsColumn.tsx:10)
- Painel: [tsx.DetailsPanel()](src/components/DetailsPanel.tsx:18)

### 3.1 Badges do nó (FULL SCAN, FILESORT, TEMP TABLE)
- FULL SCAN: quando accessType = ALL (varredura completa).
- FILESORT: quando o nó tem “using_filesort = true”.
- TEMP TABLE: quando o nó tem “using_temporary_table = true”.
- Inserção das badges: [tsx.DetailsPanel()](src/components/DetailsPanel.tsx:21)

### 3.2 Informações principais
- Campos exibidos:
  - Tipo de Acesso: traduzido (usa [ts.humanAccess()](src/lib/mermaid/buildGraph.ts:3)).
  - Tabela: nome da tabela (quando houver).
  - Custo: prefix_cost (ou query_cost como fallback).
  - Linhas Lidas (rows_examined_per_scan).
  - Linhas Produzidas (rows_produced_per_join).
- Origem desses valores no modelo interno:
  - Construção do ExecNode a partir do JSON do MySQL:
    - [ts.toExecNodeFromTable()](src/lib/explain/normalize.ts:16)
      - Custo = prefix_cost → query_cost → 0
      - rows_examined_per_scan → rowsExamined
      - rows_produced_per_join → rowsProduced

### 3.3 JSON Bruto (área central expansível)
- Exibe o objeto bruto (raw) do nó selecionado — útil para depuração.
- Ocupa todo o espaço disponível entre as informações (topo) e o CTA (rodapé).
- Preenchimento vertical forçado para o TextArea:
  - CSS utilitário: [src/index.css](src/index.css)
  - Implementação: [tsx.DetailsPanel()](src/components/DetailsPanel.tsx:63)

### 3.4 Ação: “Experimente o agente de SQL”
- Acesso rápido a uma ferramenta externa (abre em nova aba).
- Implementação da ação: [tsx.DetailsColumn()](src/components/columns/DetailsColumn.tsx:11)
- Posicionamento: seção fixa no rodapé do painel.

---

## Interações globais e comportamento

- Ao clicar em um nó do diagrama:
  - O ID do nó é enviado ao handler global (window.__onMermaidNodeClick).
  - O estado selectedId é atualizado.
  - O diagrama é reconstruído aplicando classe selected ao nó clicado.
  - A Coluna 3 é atualizada com detalhes do nó.
  - A lista de Análises (Coluna 1) destaca alertas do nó selecionado.
- Inicialização do Mermaid:
  - Configuração inicial (labels HTML e segurança): [tsx.useExplainAnalysis()](src/hooks/useExplainAnalysis.ts:52)

---

## Responsividade e proporções

- Coluna 1:
  - 50% do card para o TextArea (superior).
  - 50% para Ações + Análise e Sugestões (inferior), com rolagem interna do painel.
  - Grid com minmax(0, 1fr) garante que o conteúdo ocupe a metade de forma confiável:
    - [tsx.InputColumn()](src/components/columns/InputColumn.tsx:20)
- Coluna 2:
  - Contêiner com ScrollShadow, rola quando o diagrama excede a altura disponível:
    - [tsx.DiagramColumn()](src/components/columns/DiagramColumn.tsx:41)
- Coluna 3:
  - Informações do nó (altura automática) no topo.
  - JSON Bruto ocupa todo o espaço intermédio disponível.
  - CTA “Experimente o agente de SQL” no rodapé.
  - Layout com overflow controlado:
    - [tsx.DetailsPanel()](src/components/DetailsPanel.tsx:31)

Observação técnica
- A responsividade vertical depende de min-h-0 nos contêineres, h-full nos wrappers e da classe utilitária aplicada aos TextAreas em [src/index.css](src/index.css).

---

## Mensagens de erro

- JSON inválido no input:
  - A análise é abortada e um card informativo de erro aparece na lista de “Análise e Sugestões”.
  - Implementação do fallback: [tsx.useExplainAnalysis().analyze](src/hooks/useExplainAnalysis.ts:40)

---

## Glossário rápido (tipos de acesso)

- ALL: varredura completa da tabela (full table scan) — geralmente indesejado.
- index: varredura completa de um índice (full index scan).
- range: varredura por intervalo de chaves no índice.
- ref: busca por índice usando valores não exclusivos.
- eq_ref: busca por índice que retorna no máximo 1 linha (ex.: junção em PK/UK).
- system / const: acesso a tabela do sistema/constante (muito barato).

Tradução e exibição do tipo de acesso: [ts.humanAccess()](src/lib/mermaid/buildGraph.ts:3)

---

## Mapeamento de código (navegação rápida)

- Raiz e layout: [tsx.ExplainVisualizer()](src/components/ExplainVisualizer.tsx:7)
- Coluna 1:
  - Input + Ações + Painel: [tsx.InputColumn()](src/components/columns/InputColumn.tsx:13)
  - Painel de análise: [tsx.AnalysisPanel()](src/components/AnalysisPanel.tsx:11)
- Coluna 2:
  - Diagrama e container: [tsx.DiagramColumn()](src/components/columns/DiagramColumn.tsx:12)
  - Geração Mermaid: [ts.buildMermaid()](src/lib/mermaid/buildGraph.ts:31)
  - Texto do nó: [ts.generateNodeText()](src/lib/mermaid/buildGraph.ts:17)
  - Tipo de acesso: [ts.humanAccess()](src/lib/mermaid/buildGraph.ts:3)
  - Rótulo das arestas (valor acima da seta): [edgeLabel](src/lib/mermaid/buildGraph.ts:62)
- Coluna 3:
  - Wrapper/ação do agente: [tsx.DetailsColumn()](src/components/columns/DetailsColumn.tsx:10)
  - Painel de detalhes: [tsx.DetailsPanel()](src/components/DetailsPanel.tsx:18)
- Dados e heurísticas:
  - Normalização: [ts.parseExplainToTree()](src/lib/explain/normalize.ts:83)
  - Montagem de ExecNode: [ts.toExecNodeFromTable()](src/lib/explain/normalize.ts:16)
  - Heurísticas: [ts.generateAlerts()](src/lib/explain/heuristics.ts:4)
- Estilos e utilitários:
  - Regras do Mermaid e utilitário para TextArea: [src/index.css](src/index.css)

Para entender o pipeline completo e as regras detalhadas:
- Pipeline técnico: [docs/EXPLAIN-ANALYSIS.md](docs/EXPLAIN-ANALYSIS.md)
- Regras de heurísticas: [docs/EXPLAIN-RULES.md](docs/EXPLAIN-RULES.md)