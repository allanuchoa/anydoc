# Changelog - Conversor de Documentos (anydoc)

Todas as alterações notáveis desta ferramenta serão documentadas neste arquivo.

---

## [0.1.0] - 2026-10-28
### Adicionado
- Estrutura inicial da ferramenta a partir do scaffold do Allan Workbench. (Autor: Agente de IA DeepSeek V4.1 Flash Free)
- Conversão de documentos para Markdown no navegador via `@firecrawl/anydoc-wasm@0.2.4`, carregado sob demanda da CDN. (Autor: Agente de IA DeepSeek V4.1 Flash Free)
- Área de arrastar-e-soltar, seletor de arquivo, chip com nome/tamanho e remoção. (Autor: Agente de IA DeepSeek V4.1 Flash Free)
- Painel de saída em fonte mono com ações Copiar e Baixar `.md`. (Autor: Agente de IA DeepSeek V4.1 Flash Free)
- Tratamento dos códigos de erro do motor (`needsOcr`, `encrypted`, `unsupported`, `malformed`, `resourceLimit`, `missingPart`) e falha de CDN. (Autor: Agente de IA DeepSeek V4.1 Flash Free)
- SSO do Workbench: validação de sessão, redirect ao portal e escuta de `SIGNED_OUT`. (Autor: Agente de IA DeepSeek V4.1 Flash Free)
- Estilos B1: tokens do DESIGN.md + rim de 1px inspirado no Solid Glass. (Autor: Agente de IA DeepSeek V4.1 Flash Free)
- Documentação: `README.md`, `docs/PRD.md`, `docs/AGENTS.md`, `docs/PLAN.md` e `sql/setup.sql`. (Autor: Agente de IA DeepSeek V4.1 Flash Free)

### Corrigido
- **Acesso:** a interface só é revelada depois que o Supabase confirma a sessão. Antes, o
  conteúdo era renderizado esmaecido durante a checagem e, se o SDK do Supabase falhasse ao
  carregar, a ferramenta era liberada. Agora existe um portão (`#boot`) e a ferramenta fica
  em `<main id="app" hidden>` até a confirmação. (Autor: Agente de IA DeepSeek V4.1 Flash Free)
- Chip do arquivo vazava no estado inicial: `.file-chip` declara `display: flex`, que vencia o atributo `hidden`; adicionada regra global `[hidden]`. (Autor: Agente de IA DeepSeek V4.1 Flash Free)
- Dropzone não era acessível por teclado: agora tem `role="button"`, `tabindex="0"` e trata Enter/Espaço. (Autor: Agente de IA DeepSeek V4.1 Flash Free)
- Nome do arquivo truncado no chip passou a ter `title` com o nome completo. (Autor: Agente de IA DeepSeek V4.1 Flash Free)

### Validado
- Portal → card "Conversor de Documentos" (Utilidades) → ferramenta com sessão ativa: portão liberado, cabeçalho do bridge injetado (logo, e-mail, Sair). (Autor: Agente de IA DeepSeek V4.1 Flash Free)
- `.docx` (1 KB, com tabela Word) → 160 caracteres de Markdown com a tabela preservada. (Autor: Agente de IA DeepSeek V4.1 Flash Free)
- `.csv` (65 B) → tabela Markdown com cabeçalho e três linhas. (Autor: Agente de IA DeepSeek V4.1 Flash Free)
- Visitante anônimo → redirect ao portal, sem ver a ferramenta; CDN do Supabase bloqueada → portão permanece trancado com botão de recarregar. (Autor: Agente de IA DeepSeek V4.1 Flash Free)
