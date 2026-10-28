/*
  app.js - Conversor de Documentos (anydoc)

  Converte documentos para Markdown no proprio navegador com
  @firecrawl/anydoc-wasm. Nenhum byte do arquivo sai da maquina: a biblioteca
  e um WebAssembly estatico, sem OCR e sem chamadas de rede.

  Origem: https://github.com/firecrawl/anydoc (MIT)
*/
(function () {
  'use strict';

  var ENGINE_URL = 'https://cdn.jsdelivr.net/npm/@firecrawl/anydoc-wasm@0.2.4/anydoc_wasm.js';
  var ENGINE_SIZE_LABEL = '6,7 MB';
  // O wasm roda na memoria da aba; acima disso o risco de travar o navegador
  // passa a valer mais que a chance de alguem converter um arquivo desses.
  var MAX_BYTES = 25 * 1024 * 1024;

  var ENGINE_ERRORS = {
    needsOcr: ['PDF escaneado', 'Este PDF nao tem texto selecionavel. OCR nao esta disponivel nesta versao.'],
    encrypted: ['Documento protegido', 'O arquivo e criptografado ou pede senha.'],
    unsupported: ['Formato nao suportado', 'O anydoc nao converte este tipo de arquivo.'],
    malformed: ['Documento invalido', 'Nao foi possivel extrair conteudo util do arquivo.'],
    resourceLimit: ['Arquivo grande demais', 'O documento passou de um limite de seguranca da conversao.'],
    missingPart: ['Documento incompleto', 'Falta uma parte obrigatoria dentro do arquivo.']
  };

  var ui = {};
  var enginePromise = null;
  var currentFile = null;
  var lastMarkdown = '';
  var bound = false;

  function init() {
    ui.app = document.getElementById('app');
    ui.boot = document.getElementById('boot');
    ui.bootText = document.getElementById('boot-text');
    ui.bootRetry = document.getElementById('boot-retry');
    ui.dropzone = document.getElementById('dropzone');
    ui.input = document.getElementById('file-input');
    ui.chip = document.getElementById('file-chip');
    ui.fileName = document.getElementById('file-name');
    ui.fileSize = document.getElementById('file-size');
    ui.status = document.getElementById('status');
    ui.output = document.getElementById('output');
    ui.copy = document.getElementById('btn-copy');
    ui.download = document.getElementById('btn-download');
    ui.clear = document.getElementById('btn-clear');
    ui.retry = document.getElementById('btn-retry');
    ui.errorCard = document.getElementById('error-card');
    ui.errorTitle = document.getElementById('error-title');
    ui.errorMessage = document.getElementById('error-message');

    checkSession();
  }

  // A sessao e validada aqui e tambem pelo workbench-bridge (header do portal).
  // Sem sessao ativa, o usuario volta para o portal. A interface so entra no
  // DOM visivel depois desta confirmacao: falha de rede nao libera a ferramenta.
  function checkSession() {
    var client = getSupabaseClient();

    if (!client) {
      showBootError('Nao foi possivel validar a sessao. Verifique a conexao e recarregue.');
      return;
    }

    client.auth.getSession().then(function (result) {
      if (result.error || !result.data.session) {
        window.location.replace(CONFIG.PORTAL_URL);
        return;
      }

      revealApp();
      bindUI();
      setStatus('empty', 'Nenhum arquivo selecionado.');

      client.auth.onAuthStateChange(function (event) {
        if (event === 'SIGNED_OUT') {
          window.location.replace(CONFIG.PORTAL_URL);
        }
      });
    }).catch(function (err) {
      console.error('Falha ao validar a sessao:', err);
      window.location.replace(CONFIG.PORTAL_URL);
    });
  }

  function revealApp() {
    ui.boot.hidden = true;
    ui.app.hidden = false;
  }

  function showBootError(message) {
    ui.bootText.textContent = message;
    ui.bootRetry.hidden = false;
    ui.bootRetry.addEventListener('click', function () { window.location.reload(); }, { once: true });
  }

  // Listeners em elementos estaticos: ligados uma unica vez (AGENTS.md §8.3).
  function bindUI() {
    if (bound) return;
    bound = true;

    ui.input.addEventListener('change', function () {
      if (ui.input.files && ui.input.files[0]) {
        acceptFile(ui.input.files[0]);
      }
    });

    ['dragenter', 'dragover'].forEach(function (type) {
      ui.dropzone.addEventListener(type, function (event) {
        event.preventDefault();
        ui.dropzone.classList.add('is-over');
      });
    });

    ['dragleave', 'dragend'].forEach(function (type) {
      ui.dropzone.addEventListener(type, function () {
        ui.dropzone.classList.remove('is-over');
      });
    });

    ui.dropzone.addEventListener('drop', function (event) {
      event.preventDefault();
      ui.dropzone.classList.remove('is-over');
      if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]) {
        acceptFile(event.dataTransfer.files[0]);
      }
    });

    // O dropzone e um label focavel (role=button): Enter/Espaco abrem o seletor.
    ui.dropzone.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        ui.input.click();
      }
    });

    ui.clear.addEventListener('click', reset);
    ui.retry.addEventListener('click', function () {
      hideError();
      if (currentFile) convert(currentFile);
    });
    ui.copy.addEventListener('click', copyMarkdown);
    ui.download.addEventListener('click', downloadMarkdown);
  }

  function acceptFile(file) {
    hideError();
    currentFile = file;
    lastMarkdown = '';
    ui.output.value = '';
    ui.copy.disabled = true;
    ui.download.disabled = true;

    ui.fileName.textContent = file.name;
    ui.fileName.title = file.name;
    ui.fileSize.textContent = formatBytes(file.size);
    ui.chip.hidden = false;

    if (file.size > MAX_BYTES) {
      setStatus('error', 'Arquivo grande demais.');
      showError('Arquivo grande demais',
        'O limite desta versao e 25 MB, porque a conversao acontece na memoria do navegador.');
      return;
    }

    convert(file);
  }

  function convert(file) {
    hideError();
    var engineReady = enginePromise !== null;
    setStatus('loading', engineReady ? 'Preparando conversao...' : 'Baixando motor de conversao (' + ENGINE_SIZE_LABEL + ')...');

    loadEngine()
      .then(function (mod) {
        setStatus('converting', 'Convertendo...');
        // Deixa o navegador pintar o estado antes do trabalho sincrono do wasm.
        // shortcut: conversao sincrona na main thread, migrar para Web Worker
        // se aparecer arquivo que trave a UI por mais de ~1s.
        return new Promise(function (resolve) { setTimeout(resolve, 0); })
          .then(function () { return file.arrayBuffer(); })
          .then(function (buffer) {
            var bytes = new Uint8Array(buffer);
            var format = mod.formatFromBytes(bytes) || mod.formatFromExtension(extensionOf(file.name)) || null;
            return mod.toMarkdownBytes(bytes, format);
          });
      })
      .then(function (markdown) {
        lastMarkdown = markdown || '';
        ui.output.value = lastMarkdown;
        ui.copy.disabled = !lastMarkdown;
        ui.download.disabled = !lastMarkdown;
        setStatus('success', 'Pronto - ' + lastMarkdown.length.toLocaleString('pt-BR') + ' caracteres.');
      })
      .catch(function (err) {
        handleConvertError(err);
      });
  }

  // O import e o init (download do .wasm) falham juntos; zerar a promise
  // permite que "Tentar novamente" refaca a tentativa.
  function loadEngine() {
    if (!enginePromise) {
      enginePromise = import(ENGINE_URL)
        .then(function (mod) {
          return mod.default().then(function () { return mod; });
        })
        .catch(function (err) {
          enginePromise = null;
          throw err;
        });
    }
    return enginePromise;
  }

  function handleConvertError(err) {
    var code = err && err.code;
    var known = code && ENGINE_ERRORS[code];

    console.error('Falha na conversao:', err);

    if (known) {
      setStatus('error', known[0] + '.');
      showError(known[0], known[1]);
      return;
    }

    if (!code) {
      setStatus('error', 'Falha ao carregar o motor de conversao.');
      showError('Falha ao carregar o motor de conversao',
        'Nao foi possivel baixar a biblioteca (CDN). Verifique a conexao e tente novamente.');
      return;
    }

    setStatus('error', 'Falha na conversao.');
    showError('Falha na conversao', err.message || 'Erro inesperado ao ler o documento.');
  }

  function copyMarkdown() {
    if (!lastMarkdown) return;

    var done = function () { setStatus('success', 'Markdown copiado.'); };
    var fallback = function () {
      ui.output.select();
      try {
        document.execCommand('copy');
        done();
      } catch (err) {
        showError('Nao foi possivel copiar', 'Selecione o texto e copie manualmente.');
      }
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(lastMarkdown).then(done).catch(fallback);
    } else {
      fallback();
    }
  }

  function downloadMarkdown() {
    if (!lastMarkdown || !currentFile) return;

    var blob = new Blob([lastMarkdown], { type: 'text/markdown;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = currentFile.name.replace(/\.[^.]+$/, '') + '.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function reset() {
    currentFile = null;
    lastMarkdown = '';
    ui.input.value = '';
    ui.output.value = '';
    ui.chip.hidden = true;
    ui.copy.disabled = true;
    ui.download.disabled = true;
    hideError();
    setStatus('empty', 'Nenhum arquivo selecionado.');
  }

  function setStatus(state, text) {
    ui.status.dataset.state = state;
    ui.status.textContent = text;
  }

  function showError(title, message) {
    ui.errorTitle.textContent = title;
    ui.errorMessage.textContent = message;
    ui.errorCard.hidden = false;
  }

  function hideError() {
    ui.errorCard.hidden = true;
  }

  function extensionOf(name) {
    var dot = name.lastIndexOf('.');
    return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1).replace('.', ',') + ' MB';
  }

  init();
})();
