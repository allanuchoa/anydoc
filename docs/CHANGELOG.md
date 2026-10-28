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
