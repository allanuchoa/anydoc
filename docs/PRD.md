# Product Requirements Document (PRD) - Conversor de Documentos

Ferramenta `anydoc` do Allan Workbench. Categoria: `Utilidades`.

---

## 1. Contexto e Objetivos

Documentos chegam em Word, PowerPoint, Excel, OpenDocument, RTF, EPUB, CSV e PDF, e quase
todo uso posterior — LLM, nota técnica, PRD, changelog — pede Markdown. Converter fora do
navegador significa instalar Pandoc/LibreOffice ou enviar o arquivo para um serviço.

Objetivo: uma tela, zero instalação, zero upload. O arquivo é convertido na máquina do
usuário e o resultado sai em Markdown cru, pronto para colar ou baixar.

Não-objetivo: edição de documento, renderização/visualização do Markdown, lote, OCR (v0.1).

---

## 2. Requisitos Funcionais

- **RF01 — Selecionar arquivo**
  - *Descrição*: arrastar e soltar sobre a área de entrada ou clicar para abrir o seletor.
  - *Regras*: aceita as extensões do anydoc; o primeiro arquivo solto é o usado; um arquivo
    por vez; ao escolher outro, o anterior é descartado.

- **RF02 — Converter**
  - *Descrição*: converter para GitHub-Flavored Markdown usando o motor wasm do anydoc.
  - *Regras*: o formato é detectado pelos bytes (`formatFromBytes`); se a detecção falhar,
    usa a extensão (`formatFromExtension`) — necessário para CSV; arquivos acima de 25 MB
    são recusados antes do download do motor.

- **RF03 — Exibir resultado**
  - *Descrição*: mostrar o Markdown exatamente como o motor gerou, em painel mono somente
    leitura, com rolagem e seleção.
  - *Regras*: nada de "renderizar bonito" — o produto é o arquivo de saída.

- **RF04 — Copiar e baixar**
  - *Descrição*: botão Copiar (`navigator.clipboard`, com fallback `execCommand`) e botão
    Baixar `.md` (`Blob`, nome do arquivo original sem extensão).
  - *Regras*: ambos desabilitados sem resultado.

- **RF05 — Erros explícitos**
  - *Descrição*: cada falha mostra título + explicação + "Tentar novamente".
  - *Regras*: mapeamento fixo de `needsOcr`, `encrypted`, `unsupported`, `malformed`,
    `resourceLimit`, `missingPart`; falha de CDN tem mensagem própria. Estado de erro nunca
    compartilha texto com o estado vazio.

- **RF06 — Sessão única do ecossistema**
  - *Descrição*: só usuários com sessão ativa do Workbench usam a ferramenta.
  - *Regras*: `getSession()` no carregamento; sem sessão → redirect para `PORTAL_URL`;
    `SIGNED_OUT` → redirect; cabeçalho comum injetado pelo `workbench-bridge.js`.

---

## 3. Requisitos de Banco de Dados

Nenhuma tabela própria. A ferramenta é stateless.

Uso do registry do portal, apenas `INSERT` (ver `sql/setup.sql`):

| Tabela | Uso |
|---|---|
| `public.applications` | uma linha: `slug = 'anydoc'`, `name = 'Conversor de Documentos'`, `category = 'Utilidades'`, `icon = 'file-text'` |
| `public.user_applications` | vínculo usuário ↔ ferramenta |

Nenhuma policy deve ser criada ou alterada nessas tabelas (contrato do registry).

---

## 4. Esboço de Tela

```
┌ Conversor de Documentos ─────────────────────────────────────────────┐
│ Word, PowerPoint, ... → Markdown. A conversão roda no seu navegador. │
├───────────────────────────┬──────────────────────────────────────────┤
│ ┌───────────────────────┐ │ Markdown          [Copiar] [Baixar .md]  │
│ │  Arraste um documento │ │ ┌──────────────────────────────────────┐ │
│ │  aqui                 │ │ │ (textarea mono, readonly)            │ │
│ │  ou clique ...        │ │ │                                      │ │
│ │  .docx .pdf ...       │ │ │                                      │ │
│ └───────────────────────┘ │ └──────────────────────────────────────┘ │
│ file.docx   48 KB  Remover│                                          │
│ ● Pronto - 9.160 caracteres                                          │
├──────────────────────────────────────────────────────────────────────┤
│ (card de erro, quando houver)                       [Tentar novamente]│
└──────────────────────────────────────────────────────────────────────┘
```

Grid de duas colunas a partir de 900 px; empilhado abaixo disso.

---

## 5. Critérios de aceite da v0.1

1. `.docx`, `.pptx`, `.xlsx`, `.odt`, `.rtf`, `.epub`, `.csv` e PDF de texto convertem.
2. PDF escaneado mostra a mensagem de `needsOcr`, sem travar.
3. Copiar coloca o markdown na área de transferência; Baixar gera `<nome>.md`.
4. Sem sessão, a página redireciona ao portal.
5. Nenhuma requisição contém o documento do usuário (só o download do motor na CDN).
6. Recarregar com o motor em cache converte sem novo download.
