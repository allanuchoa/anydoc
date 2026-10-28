# Diretrizes para Agentes de IA - Conversor de Documentos (anydoc)

Contexto local desta ferramenta. As regras globais do ecossistema valem em cima destas.
O `README.md` (raiz deste repositório) é a fonte principal de documentação.

---

## 1. Escopo

- Trabalhe apenas neste diretório. Nada de ler ou editar outras ferramentas do workbench.
- Esta ferramenta **não tem tabela no Supabase** e não deve ganhar uma sem necessidade.
- O registry do portal (`applications`, `user_applications`, `profiles`) recebe apenas
  `INSERT` — nunca `CREATE POLICY`/`DROP POLICY` (recursão `42P17` derruba o portal).

---

## 2. Stack (não negociável)

- HTML + CSS + JS nativos. Sem React, Vue, Svelte, sem bundler, sem TypeScript, sem Tailwind.
- O motor é importado em runtime:
  `https://cdn.jsdelivr.net/npm/@firecrawl/anydoc-wasm@0.2.4/anydoc_wasm.js`.
  Ao subir de versão, atualize `ENGINE_URL` em `app.js` **e** o número no `README.md` e no
  `CHANGELOG.md`. Nunca use `@latest`: o `.wasm` é servido por URL imutável e o pin é o que
  garante cache e reprodutibilidade.
- Não copie o `.wasm` (6,7 MB) para o repositório sem decidir antes com o dono do projeto.

---

## 3. API do motor (conferida na prática, v0.2.4)

```js
const mod = await import(ENGINE_URL);
await mod.default();                                  // baixa e inicializa o .wasm
mod.formatFromBytes(bytes)                            // 'docx' | 'xlsx' | ... | undefined
mod.formatFromExtension('csv')                        // fallback; obrigatório para CSV
mod.toMarkdownBytes(bytes, format)                    // string markdown, SÍNCRONO
```

- `toMarkdownBytes` é síncrono e roda na main thread. Não envolva em `async` esperando
  mágica: o código cede um tick (`setTimeout(0)`) só para o navegador pintar o estado antes.
- Em Node (teste de fumaça), o default export é `init`, não `initSync`:
  `await init({ module_or_path: readFileSync('...anydoc_wasm_bg.wasm') })`.
- Os erros publicam `error.code` (string). O mapeamento de mensagens vive em `ENGINE_ERRORS`
  no `app.js`; use `needsOcr` como gancho do futuro OCR.

---

## 4. Contratos de UI herdados do AGENTS.md global

- Os quatro estados (`loading`, `empty`, `error`, `success`) são obrigatórios e nunca
  compartilham mensagem.
- Listeners em elementos estáticos são ligados **uma vez** (flag `bound` em `bindUI`).
- `onAuthStateChange` com `SIGNED_OUT` → volta ao portal.
- O portão de sessão é `<main id="app" hidden>` + `#boot`: nunca revele a ferramenta por
  falha de rede ou de CDN. Se o Supabase não carregar, mostre o erro **no portão**.
- Nada de `outline: none` sem substituto: `:focus-visible` está em `styles.css`.
- Cor de erro é o token `--color-danger`.

---

## 5. Decisões visuais (B1)

O design segue o `DESIGN.md`: canvas `#101010`, hairline `#3d3a39`, raio 6–8px, sem sombra
projetada. O único empréstimo do Solid Glass é o *rim* de 1px no topo do pane
(`box-shadow: inset 0 1px 0 rgba(255,255,255,.06)`) e o pane em `#1a1a1a`.

Não vendorize `solid-glass.css`: a paleta (oklch claro), o raio 14px e o blur conflitam com
o DESIGN.md. A comparação completa está em `docs/PLAN.md`.

---

## 6. Atalhos técnicos registrados (`shortcut:`)

- Conversão síncrona na main thread — migrar para Web Worker se algum arquivo travar a UI
  por mais de ~1s.
- Limite fixo de 25 MB em `MAX_BYTES` — revisar se aparecer uso real acima disso.
- OCR inexistente na v0.1 — `needsOcr` só informa o usuário.

---

## 7. Checklist antes de commitar

1. Abrir a página via HTTP e converter ao menos um `.docx` e um `.csv`.
2. Testar um PDF escaneado (mensagem de `needsOcr`) e um arquivo com extensão trocada
   (detecção por bytes).
3. `CHANGELOG.md` atualizado no formato `## [versão] - AAAA-MM-DD`.
