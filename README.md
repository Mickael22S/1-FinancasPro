# FinançasPro

Aplicativo web de finanças pessoais. Permite registrar receitas, gastos e dívidas parceladas, acompanhar tudo em um calendário mensal e criar metas de poupança com plano por mês, semana e dia. O dashboard mostra o panorama geral e a situação financeira.

## Funcionalidades

- **Receitas e gastos** por categoria, com data e valor.
- **Dívidas parceladas**: as parcelas e os vencimentos são gerados automaticamente, e cada parcela pode ser marcada como paga.
- **Calendário mensal** com os lançamentos de cada dia e os próximos vencimentos.
- **Metas de poupança** com valor por mês, por semana e por dia, além de uma avaliação se a meta cabe no orçamento.
- **Dashboard** com totais, comprometimento da renda com dívidas e gastos em relação às receitas.
- **Tema** claro, escuro ou automático, e layout adaptado para celular.

## Estrutura do projeto

    financaspro/
    ├── index.html
    ├── css/
    │   └── style.css
    └── js/
        └── script.js

## Como usar

1. Baixe ou clone o repositório.
2. Abra o arquivo `index.html` no navegador.

Não é preciso instalar nada nem rodar servidor.

## Dados

Todas as informações ficam salvas no `localStorage` do navegador, apenas no seu aparelho. Limpar os dados do navegador apaga os lançamentos.

## Tecnologias

HTML, CSS e JavaScript puros, sem frameworks.
