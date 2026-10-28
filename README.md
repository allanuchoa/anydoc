# anydoc — Conversor de Documentos

Ferramenta do **Allan Workbench** que converte documentos de escritório em Markdown limpo,
**no próprio navegador**.

Hospedada em `https://allanuchoa.github.io/anydoc/` e registrada no portal central como
`anydoc`, categoria `Utilidades`.

| Entra | Sai |
|---|---|
| `.doc` `.docx` `.docm` · `.ppt` `.pps` `.pot` `.pptx` `.pptm` `.ppsx` `.ppsm` · `.xls` `.xlsx` `.xlsm` `.xlsb` · `.odt` `.ods` `.odp` · `.rtf` · `.epub` · `.csv` · `.pdf` (com texto) | GitHub-Flavored Markdown: títulos com âncora, tabelas, listas, notas de rodapé, equações em LaTeX, código |

---

## 1. Origem

Esta ferramenta é uma interface própria sobre a biblioteca **anydoc**, do Firecrawl:

- Repositório: <https://github.com/firecrawl/anydoc> (licença MIT)
- Pacote usado: [`@firecrawl/anydoc-wasm@0.2.4`](https://www.npmjs.com/package/@firecrawl/anydoc-wasm)
- Demo oficial: <https://firecrawl.github.io/anydoc/>

O anydoc é escrito em Rust e compila para WebAssembly. A conversão é 100% local: **nenhum
byte do documento sai da máquina**, não há backend, chave de API ou chamada de rede durante
a conversão. A única rede envolvida é o download da própria biblioteca (CDN) na primeira
utilização.

Não há código do anydoc copiado neste repositório — a biblioteca é importada do CDN em tempo
de execução, com versão fixa. A UI, a autenticação e o cabeçalho são do Workbench.

---

## 2. O que a ferramenta faz

- **Arrastar e soltar** (ou clicar) um documento.
- Carrega o motor wasm sob demanda e converte.
- Mostra o Markdown cru em um painel mono, com **Copiar** e **Baixar `.md`**.
- Trata cada falha com mensagem própria, nunca com tela branca.

Estados de interface (contrato do `AGENTS.md` §8): `empty` → `loading` (download do motor)
→ `converting` → `success` / `error` (com "Tentar novamente").

### Códigos de erro do motor, traduzidos

| `error.code` | Mensagem na tela |
|---|---|
| `needsOcr` | PDF escaneado — sem texto selecionável; OCR não disponível nesta versão |
| `encrypted` | Documento protegido / com senha |
| `unsupported` | Formato não suportado |
| `malformed` | Documento inválido, sem conteúdo útil |
| `resourceLimit` | Passou de um limite de segurança da conversão |
| `missingPart` | Falta uma parte obrigatória do arquivo |
| *(sem código)* | Falha ao baixar a biblioteca do CDN |

---

## 3. Limitações conhecidas (v0.1)

1. **PDF escaneado não converte.** O wasm do anydoc não faz OCR e não faz chamadas de rede.
   O gancho já existe (`error.code === 'needsOcr'`); OCR é a evolução natural — local
   (`pdf.js` + `tesseract.js`) ou hospedado (Supabase Edge Function → Firecrawl Parse).
2. **25 MB por arquivo.** Guarda de memória: o wasm roda na aba. Acima disso o risco de
   travar o navegador supera o uso real.
3. **Um arquivo por vez.** Sem lote.
4. **Conversão síncrona na main thread.** Mediana de ~4 ms por documento, então a UI não
   trava; a marcação `shortcut:` no `app.js` diz quando migrar para Web Worker.
5. **Sem persistência.** Nada é gravado no Supabase; fechar a aba perde o resultado.
6. **A página é pública por URL.** O gate de SSO é do lado do cliente, como em todas as
   ferramentas do ecossistema — não há dado sensível servido por ela.

---

## 4. Estrutura

```
index.html                  interface (pane de entrada + pane de saída)
styles.css                  tokens do DESIGN.md + componentes da ferramenta
app.js                      conversão, estados, erros, copy/download
config.js                   chaves públicas do Supabase + URL do portal
supabase.js                 client Supabase (sessão compartilhada do workbench)
.github/workflows/deploy.yml  deploy do GitHub Pages a cada push na main
docs/PRD.md                 requisitos
docs/AGENTS.md              regras locais para agentes de IA
docs/CHANGELOG.md           histórico
docs/PLAN.md                plano de construção e decisões (B1, B2, A)
sql/setup.sql               registro no registry do portal (INSERT idempotente)
```

Sem build, sem `node_modules`, sem bundler. Só HTML, CSS e JS nativos.

---

## 5. Autenticação (SSO do Workbench)

O padrão é o do ecossistema, nada específico desta ferramenta:

- `config.js` aponta `PORTAL_URL` para o portal central.
- O `index.html` injeta `assets/js/workbench-bridge.js` do portal, que:
  - valida a sessão com `supabase.auth.getSession()`;
  - injeta o cabeçalho comum (logo, e-mail, Sair);
  - redireciona para o portal se não houver sessão.
- `app.js` valida a sessão por conta própria (defesa em profundidade), sai do estado
  `app-loading` e escuta `SIGNED_OUT` para voltar ao portal.
- A sessão é compartilhada via `localStorage`, chave `sb-<project-id>-auth-token`. Isso só
  funciona porque portal e ferramentas vivem no **mesmo origin** (`allanuchoa.github.io`).

---

## 6. Rodar localmente

Precisa de um servidor HTTP (o módulo ES e o `.wasm` não carregam em `file://`).

```bash
python -m http.server 8000
# abra http://localhost:8000
```

**Pegadinha do SSO local:** o portal e a ferramenta precisam estar no mesmo origin para
compartilhar a sessão. O jeito simples é servir a pasta do workbench inteira:

```bash
# na raiz do workbench
python -m http.server 8000
# portal:     http://localhost:8000/0.%20login%20portal/
# ferramenta: http://localhost:8000/10.%20anydoc/
```

E ajustar `PORTAL_URL` em `config.js` para `http://localhost:8000/0. login portal/`
(sem commitar). Se abrir a ferramenta sozinha em outro origin, o bridge não acha sessão e
redireciona para o portal de produção.

**Teste rápido do motor sem browser** (verifica o mesmo caminho de chamada do `app.js`):

```bash
npm i @firecrawl/anydoc-wasm@0.2.4
node -e "import('@firecrawl/anydoc-wasm').then(async m => { await m.default({module_or_path: require('fs').readFileSync('node_modules/@firecrawl/anydoc-wasm/anydoc_wasm_bg.wasm')}); const b = new Uint8Array(require('fs').readFileSync('arquivo.xlsx')); console.log(m.toMarkdownBytes(b, m.formatFromExtension('xlsx')).slice(0,200)) })"
```

---

## 7. Deploy

1. Repositório: `allanuchoa/anydoc`.
2. GitHub → Settings → Pages → **Source: GitHub Actions**.
3. Push na `main` dispara `.github/workflows/deploy.yml` (checkout → configure-pages →
   upload artifact → deploy). Sem build, sem Rust.
4. URL publicada: `https://allanuchoa.github.io/anydoc/`.

> **Atenção:** o GitHub Pages a partir de repositório **privado** exige plano pago
> (Pro/Team/Enterprise). Em conta Free, o repositório precisa ser público — a página
> publicada é pública de qualquer forma.

---

## 8. Registro no portal

Manual, no SQL Editor do Supabase (roda como `service_role`):

1. Preencher os placeholders de `sql/setup.sql` (`<uuid-do-usuario>`).
2. Rodar o script inteiro — é idempotente (`ON CONFLICT`), pode reexecutar.
3. Recarregar o portal logado; o card "Conversor de Documentos" aparece na categoria
   `Utilidades`.

O script **só faz `INSERT`** em `applications` e `user_applications`. Nunca recriar policies
dessas tabelas (causa recursão infinita `42P17` e derruba o portal).

---

## 9. Decisões de projeto

- **Por que não um fork do repo do Firecrawl?** O fork funcionaria (o site deles já é
  estático), mas a UI seria a vitrine do Firecrawl e o build carregaria uma toolchain Rust.
  A página própria tem ~150 linhas, sem build, sem CI e com a identidade do Workbench.
- **Por que importar do CDN em vez de vendorizar o `.wasm`?** O binário tem 6,7 MB; mantê-lo
  fora do git evita inflar o repositório e atualizar é trocar a versão na URL. Trade-off:
  depende do jsDelivr em runtime (falha → estado de erro com "Tentar novamente").
- **Por que o CSS não é o Solid Glass?** O Solid Glass é React + Tailwind + shadcn e define
  sua própria paleta clara/raio 14px/blur, conflitando com o DESIGN.md (`#101010`, raio 6–8px,
  sem sombras). Aplicamos só a parte compatível — o *rim* de 1px no topo do pane, pane em
  `#1a1a1a` e mono na saída (opção "B1"). Ver `docs/PLAN.md` para a comparação completa.
