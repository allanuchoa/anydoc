# Plano de Construção — Conversor de Documentos (anydoc)

Registro das decisões tomadas para trazer o [anydoc](https://github.com/firecrawl/anydoc)
para o Allan Workbench. Data: 2026-10-28.

---

## 1. O que foi avaliado

O anydoc é uma biblioteca Rust com binding WebAssembly. O site de demonstração do projeto já
é estático: converte no navegador, sem backend. Isso abria três caminhos.

| | **A — fork + Pages** | **B — página própria** | **C — B + Edge Function** |
|---|---|---|---|
| OCR | não | não | sim (Firecrawl Parse) |
| Visual | o do Firecrawl | o do Workbench | o do Workbench |
| Código novo | 1 linha no workflow do fork | ~150 linhas | B + ~40 linhas Deno |
| Build/CI | Rust + wasm-pack (trocar runner `blacksmith` → `ubuntu-latest`) | nenhum | deploy via Supabase CLI |
| Runtime | repo forkado | CDN jsDelivr | CDN + Parse |
| Dado sai da máquina | nunca | nunca | PDF escaneado sai |

**Decisão: B**, sem OCR nesta versão.

Motivos: o A entrega a vitrine do Firecrawl com uma toolchain Rust para manter; o B cabe no
stack do workbench (HTML/CSS/JS puro, sem build) e permite a identidade visual própria. O
único ganho real do A/C sobre o B é OCR — e OCR ficou para depois, porque o motor wasm não
faz OCR e o gancho (`error.code === 'needsOcr'`) já está no código.

---

## 2. Variante visual: B1 vs B2

O design system sugerido, [Solid Glass](https://github.com/deeplethe/solid-glass), é React 19
+ Tailwind 4 + shadcn/ui. O tema é um único arquivo (`src/solid-glass.css`, 55 KB, 1410
linhas) com tokens reais em `:root`/`.dark` e classes próprias (`--panel`, `--glass-rim`,
`.glass-panel`), funcionando fora do Tailwind — o bloco `@theme` é ignorado pelo browser.

O problema não é técnico, é de contrato: o Solid Glass define fundo claro
`oklch(0.925 …)`, raio 14px, blur e sombra em cada pane. O `DESIGN.md`/`AGENTS.md` do
workbench exige `#101010`, raio 6–8px, hairline 1px e **sem sombra projetada**. Sobrescrever
tudo isso deixaria pouco do que motivou a escolha.

| | **B1 (escolhido)** | **B2** |
|---|---|---|
| Base | `styles.css` do scaffold | `solid-glass.css` vendorizado + overrides |
| CSS novo | ~80 linhas | ~20 linhas de override + manutenção de dois sistemas de tokens |
| Conformidade | total com o DESIGN.md | parcial (sombras/blur precisam ser removidos) |

**B1**: tokens do workbench + o empréstimo que cabe — *rim* de 1px no topo do pane, pane em
`#1a1a1a`, mono na saída, verde elétrico só na ação principal, um estado por vez.

---

## 3. Arquitetura entregue

```
index.html   -> gate: app-loading, injeta workbench-bridge.js, dois panes
styles.css   -> tokens + .pane, .dropzone, .output, .status, .error-card
app.js       -> sessão, bindUI, acceptFile, convert, loadEngine, erros, copy/download
config.js    -> Supabase + PORTAL_URL (scaffold)
supabase.js  -> client com storageKey compartilhado (scaffold)
```

Fluxo de conversão:

1. `drop`/`change` → `acceptFile` (guarda de 25 MB).
2. `loadEngine()` → `import()` da versão fixa + `init()` (baixa 6,7 MB; cacheado depois).
3. `setTimeout(0)` para pintar o estado, `file.arrayBuffer()`.
4. `formatFromBytes(bytes) || formatFromExtension(ext) || null` → `toMarkdownBytes(bytes, fmt)`.
5. Resultado no `<textarea>`; Copiar/Baixar habilitados; status `success`.

Sem tabela no Supabase; a ferramenta é stateless. O portal só a exibe (registry).

---

## 4. Passos executados

- [x] Validar a API do motor num teste de fumaça em Node (`xlsx` de 69 KB → 9.160 caracteres).
- [x] Criar a estrutura a partir de `template/scaffold/` (`config.js`, `supabase.js`,
      `deploy.yml`).
- [x] `index.html`, `styles.css`, `app.js`.
- [x] `README.md`, `docs/PRD.md`, `docs/AGENTS.md`, `docs/CHANGELOG.md`, este plano.
- [x] `sql/setup.sql` (idempotente, só `INSERT`).
- [x] Repositório `allanuchoa/anydoc` e push da `main`.
- [ ] **Manual:** rodar `sql/setup.sql` no SQL Editor do Supabase (preencher o UUID do
      usuário) — o Supabase CLI local aponta para outro projeto.
- [ ] Habilitar GitHub Pages (Source: GitHub Actions) e acompanhar o primeiro deploy.
- [ ] Smoke test em produção: card no portal → conversão de `.docx` e `.csv`; PDF escaneado
      exibindo `needsOcr`.

---

## 5. Backlog (não desta versão)

1. **OCR** — caminho local (`pdf.js` + `tesseract.js`, grátis, arquivo não sai da máquina,
   porém ~15–20 MB de modelo e qualidade inferior) ou hospedado (Edge Function guardando a
   chave do Firecrawl Parse, com limite de payload a verificar).
2. **Web Worker** — tirar a conversão da main thread quando aparecer arquivo que trave a UI.
3. **Lote** — converter vários arquivos e baixar um `.zip` (exigiria um zip em JS; hoje fora).
4. **Pré-visualização** do markdown renderizado, se houver uso real.

---

## 6. Riscos conhecidos

- Dependência de CDN em runtime (mitigada por versão fixa + estado de erro com retry).
- 6,7 MB no primeiro uso (mitigado por cache do browser e pelo estado de loading).
- Pages a partir de repositório privado exige plano pago; se a conta for Free, publicar o
  repositório é o caminho.
- A conversão é síncrona; um arquivo patológico pode travar a aba por alguns segundos.
