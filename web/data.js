/* ===========================================================================
 * MetroCal — camada de dados
 *
 * Cada entidade é uma aba da pasta de trabalho; a linha 1 é o cabeçalho e os
 * dados começam na linha 2. Datas circulam como texto ISO ("2026-09-05") e
 * são normalizadas na leitura, porque o Excel pode convertê-las para data de
 * verdade ao gravar — nesse caso voltam como "2026-09-05T00:00:00" e os
 * primeiros 10 caracteres continuam certos.
 *
 * Arquivos (fotos e PDFs): se o add-in compilado responde fileSave/fileRead,
 * ficam na pasta "arquivos/" ao lado da pasta de trabalho e a planilha guarda
 * "file:<nome>". Sem build, caem em base64 fatiado na aba Arquivos e a
 * planilha guarda "db:<nome>".
 * ======================================================================== */
'use strict';

const DB = (function () {

  const SHEETS = {
    instrumentos: {
      name: 'Instrumentos',
      cols: ['ID','Descricao','Fabricante','Modelo','NumSerie','Localizacao','Responsavel',
             'Status','Grandeza','Unidade','FaixaMin','FaixaMax','Resolucao','Classe','Saida',
             'IntervaloMeses','UltimaCal','ProximaCal','Foto','Obs']
    },
    padroes: {
      name: 'Padroes',
      cols: ['ID','Descricao','Tipo','Grandeza','Unidade','Faixa','Certificado','Laboratorio',
             'DataCal','Validade','Incerteza','Status','PadraoSuperior','Obs']
    },
    aplicacoes: {
      name: 'Aplicacoes',
      cols: ['ID','Descricao','Grandeza','Unidade','FaixaMin','FaixaMax','EMA','Regra','Obs']
    },
    vinculos: { name: 'Vinculos', cols: ['ID','Instrumento','Aplicacao','Ativo'] },
    calibracoes: {
      name: 'Calibracoes',
      cols: ['ID','Instrumento','Data','Metrologista','Procedimento','Temperatura','Umidade',
             'Tipo','Resultado','Regra','CertificadoRef','Status','AssinadoPor','DataAssinatura','Obs']
    },
    pontos: {
      name: 'CalPontos',
      cols: ['Calibracao','Ordem','Ponto','Nominal','Padrao','R1','R2','R3','Media','Erro','U','K']
    },
    calpadroes: { name: 'CalPadroes', cols: ['Calibracao','Padrao'] },
    agenda: {
      name: 'Agenda',
      cols: ['ID','Instrumento','DataPrevista','Responsavel','Status','Obs']
    },
    ocorrencias: {
      name: 'Ocorrencias',
      cols: ['ID','Data','Instrumento','Tipo','Descricao','Responsavel','Status']
    },
    auditoria: {
      name: 'Auditoria',
      cols: ['ID','DataHora','Usuario','Acao','Entidade','EntidadeID','Detalhe']
    },
    usuarios: { name: 'Usuarios', cols: ['ID','Nome','Perfil'] },
    config: { name: 'Config', cols: ['Chave','Valor'] },
    arquivos: { name: 'Arquivos', cols: ['Nome','Parte','Base64'] },
    documentos: { name: 'Documentos', cols: ['ID','Entidade','EntidadeID','Nome','Ref'] }
  };

  /* --- bridge ------------------------------------------------------------- */

  async function call(action, data) {
    return await bridge.call(action, data); // rejeições sobem; quem chama decide
  }

  /* --- leitura/escrita de baixo nível ------------------------------------- */

  function normCell(v) { return v === undefined ? null : v; }

  async function nextRow(sheetName) {
    const used = await call('usedRange', { sheet: sheetName });
    if (!used) return 1;
    if (used.address === 'A1') {
      const v = await call('readRange', { sheet: sheetName, address: 'A1' });
      if (!v || v[0][0] === null) return 1;
    }
    return used.rows + 1;
  }

  async function writeRowAt(key, rowNum, values) {
    await call('writeRange', { sheet: SHEETS[key].name, address: 'A' + rowNum, rows: [values] });
  }

  async function appendRow(key, values) {
    const row = await nextRow(SHEETS[key].name);
    await writeRowAt(key, row, values);
    return row;
  }

  async function table(key) {
    const meta = SHEETS[key];
    const used = await call('usedRange', { sheet: meta.name });
    if (!used || used.address === 'A1') {
      if (!used) return [];
      const probe = await call('readRange', { sheet: meta.name, address: 'A1' });
      if (!probe || probe[0][0] === null) return [];
    }
    const rows = await call('readRange', { sheet: meta.name, address: used.address });
    if (!rows || rows.length < 2) return [];
    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (r.every(v => v === null || v === '')) continue;
      const obj = { __row: i + 1 };
      meta.cols.forEach((c, j) => { obj[c] = normCell(r[j]); });
      out.push(obj);
    }
    return out;
  }

  function toRow(key, obj) {
    return SHEETS[key].cols.map(c => obj[c] === undefined ? null : obj[c]);
  }

  async function insert(key, obj) {
    const row = await appendRow(key, toRow(key, obj));
    obj.__row = row;
    return obj;
  }

  async function update(key, id, patch) {
    const rows = await table(key);
    const cur = rows.find(r => String(r.ID) === String(id));
    if (!cur) throw new Error('Registro não encontrado: ' + id);
    Object.assign(cur, patch);
    await writeRowAt(key, cur.__row, toRow(key, cur));
    return cur;
  }

  async function find(key, id) {
    const rows = await table(key);
    return rows.find(r => String(r.ID) === String(id)) || null;
  }

  /* --- config / auditoria -------------------------------------------------- */

  async function config(chave, valor) {
    const rows = await table('config');
    const cur = rows.find(r => r.Chave === chave);
    // Sempre texto na leitura: o Excel converte "1" em número ao gravar, e
    // `seeded !== '1'` com 1 numérico re-semeava a base a cada abertura do painel.
    if (valor === undefined) return cur && cur.Valor !== null && cur.Valor !== '' ? String(cur.Valor) : null;
    if (cur) {
      await writeRowAt('config', cur.__row, [chave, String(valor)]);
    } else {
      await appendRow('config', [chave, String(valor)]);
    }
    return valor;
  }

  async function currentUser() {
    return (await config('usuarioAtual')) || 'Sistema';
  }

  async function audit(acao, entidade, entidadeId, detalhe) {
    const usuario = await currentUser();
    const agora = new Date();
    const stamp = agora.getFullYear() + '-' + pad2(agora.getMonth() + 1) + '-' + pad2(agora.getDate())
      + 'T' + pad2(agora.getHours()) + ':' + pad2(agora.getMinutes());
    await appendRow('auditoria',
      ['AUD-' + Date.now(), stamp, usuario, acao, entidade, String(entidadeId || ''), detalhe || '']);
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  async function nextCalId(dateISO) {
    const ano = (dateISO || Domain.todayISO()).slice(0, 4);
    const seq = parseInt((await config('seqCal')) || '871', 10) + 1;
    await config('seqCal', String(seq));
    return 'CAL-' + ano + '-' + String(seq).padStart(4, '0');
  }

  async function nextSeqId(prefix, key) {
    const rows = await table(key);
    let max = 0;
    rows.forEach(r => {
      const m = /(\d+)\s*$/.exec(String(r.ID || ''));
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return prefix + '-' + String(max + 1).padStart(2, '0');
  }

  /* --- criação das abas ---------------------------------------------------- */

  async function ensureSheets() {
    const existing = await call('listSheets');
    for (const key of Object.keys(SHEETS)) {
      const meta = SHEETS[key];
      if (existing.indexOf(meta.name) >= 0) continue;
      const made = await call('addSheet', { name: meta.name });
      meta.name = made.name; // nome real usado (sanitizado/único)
      await call('writeRange', { sheet: meta.name, address: 'A1', rows: [meta.cols] });
      await call('setFill', { sheet: meta.name, address: 'A1:' + colLetter(meta.cols.length) + '1', color: '#0e1f30' });
      await call('setFont', { sheet: meta.name, address: 'A1:' + colLetter(meta.cols.length) + '1', bold: true, color: '#ffffff' });
    }
  }

  function colLetter(n) {
    let out = '';
    while (n > 0) { const rest = (n - 1) % 26; out = String.fromCharCode(65 + rest) + out; n = (n - rest - 1) / 26; }
    return out;
  }

  /* --- init / reset -------------------------------------------------------- */

  async function init() {
    await ensureSheets();
    const seeded = await config('seeded');
    if (seeded !== '1') {
      await Seed.run();
      await config('seeded', '1');
      return { seeded: true };
    }
    return { seeded: false };
  }

  // Sem ação de "apagar aba" na bridge: o reset cobre a área usada com células
  // vazias e grava o conjunto novo por cima.
  async function reset() {
    for (const key of Object.keys(SHEETS)) {
      const meta = SHEETS[key];
      const used = await call('usedRange', { sheet: meta.name });
      if (used && used.rows > 1) {
        const blank = [];
        for (let i = 0; i < used.rows - 1; i++) blank.push(meta.cols.map(() => null));
        await call('writeRange', { sheet: meta.name, address: 'A2', rows: blank });
      }
    }
    await Seed.run();
    await config('seeded', '1');
  }

  return {
    SHEETS, init, reset, table, find, insert, update,
    appendRow, writeRowAt, config, audit, currentUser, nextCalId, nextSeqId, call
  };
})();

/* ===========================================================================
 * Files — fotos e PDFs
 * ======================================================================== */

const Files = (function () {
  let external = null; // null = ainda não detectado

  // O add-in compilado mapeia a pasta "arquivos/" (ao lado da pasta de
  // trabalho) neste host: a imagem entra no HTML como uma URL comum, sem
  // base64 atravessando a ponte. null = ainda não sondado; só o sucesso é
  // cacheado — uma sonda que falhou tenta de novo na leitura seguinte.
  const FILES_HOST = 'files.app.local';
  let httpFiles = null;

  function fileUrl(name) {
    return 'https://' + FILES_HOST + '/' + encodeURIComponent(name);
  }

  function probeImage(url) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });
  }

  async function init() {
    if (external) return external; // só o sucesso é cacheado: uma sonda que falhou
    try {                          // (Excel ocupado no boot do painel) tenta de novo
      await bridge.call('fileList'); // na próxima leitura em vez de desligar as
      external = true;               // imagens pelo resto da sessão
    } catch (e) {
      external = false; // sem build: cai para a aba Arquivos
      console.warn('[Files] sonda fileList falhou:', e && e.message ? e.message : e);
    }
    return external;
  }

  function mimeOf(name) {
    const ext = (name.split('.').pop() || '').toLowerCase();
    return {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
      webp: 'image/webp', bmp: 'image/bmp', pdf: 'application/pdf'
    }[ext] || 'application/octet-stream';
  }

  function chunk(s, size) {
    const out = [];
    for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size));
    return out;
  }

  async function save(name, base64) {
    await init();
    if (external) {
      const res = await bridge.call('fileSave', { name: name, base64: base64 });
      return 'file:' + res.name;
    }
    // fallback: fatias de 30.000 caracteres na aba Arquivos
    const rows = await DB.table('arquivos');
    const mine = rows.filter(r => r.Nome === name);
    const parts = chunk(base64, 30000);
    for (let i = 0; i < parts.length; i++) {
      if (i < mine.length) await DB.writeRowAt('arquivos', mine[i].__row, [name, i, parts[i]]);
      else await DB.appendRow('arquivos', [name, i, parts[i]]);
    }
    for (let i = parts.length; i < mine.length; i++) {
      await DB.writeRowAt('arquivos', mine[i].__row, [name, -1, '']);
    }
    return 'db:' + name;
  }

  async function readDataUrl(ref) {
    if (!ref) return null;
    try {
      const name = String(ref).slice(String(ref).indexOf(':') + 1);
      if (String(ref).indexOf('file:') === 0) {
        // Caminho preferido: a pasta arquivos/ servida pelo add-in como host
        // local — o <img> carrega direto, sem nada atravessando a ponte.
        const url = fileUrl(name);
        if (httpFiles) return url;
        if (await probeImage(url)) {
          httpFiles = true;
          return url;
        }
        // Host não mapeado (build antigo) ou arquivo ausente: cai para a ponte.
      }
      await init();
      let b64 = null;
      if (String(ref).indexOf('file:') === 0 && external) {
        const res = await bridge.call('fileRead', { name: name });
        b64 = res ? res.base64 : null;
        if (!b64) console.warn('[Files] não encontrado na pasta arquivos/:', name);
      } else if (String(ref).indexOf('db:') === 0) {
        const rows = await DB.table('arquivos');
        b64 = rows.filter(r => r.Nome === name && r.Parte !== -1 && r.Parte !== '-1')
          .sort((a, b) => Number(a.Parte) - Number(b.Parte))
          .map(r => r.Base64 || '').join('') || null;
      }
      return b64 ? 'data:' + mimeOf(name) + ';base64,' + b64 : null;
    } catch (e) {
      // Uma foto ilegível não pode derrubar a tela inteira: sem ela, a tela
      // renderiza com o placeholder no lugar da imagem.
      console.warn('[Files] falha ao ler', ref, e && e.message ? e.message : e);
      return null;
    }
  }

  async function open(ref) {
    if (!ref) return;
    await init();
    const name = String(ref).slice(String(ref).indexOf(':') + 1);
    if (String(ref).indexOf('file:') === 0 && external) {
      await bridge.call('fileOpen', { name: name });
      return;
    }
    const url = await readDataUrl(ref);
    if (url) window.open(url, '_blank');
  }

  async function remove(ref) {
    if (!ref) return;
    await init();
    const name = String(ref).slice(String(ref).indexOf(':') + 1);
    if (String(ref).indexOf('file:') === 0 && external) {
      await bridge.call('fileDelete', { name: name });
    } else {
      const rows = await DB.table('arquivos');
      for (const r of rows.filter(x => x.Nome === name)) {
        await DB.writeRowAt('arquivos', r.__row, [name, -1, '']);
      }
    }
  }

  return { init, save, readDataUrl, open, remove, isExternal: () => external };
})();

/* ===========================================================================
 * Domain — regras de negócio da metrologia
 * ======================================================================== */

const Domain = (function () {

  /* --- datas --------------------------------------------------------------- */

  function normDate(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') { // serial OADate, por garantia
      const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v * 86400000));
      return d.toISOString().slice(0, 10);
    }
    return String(v).slice(0, 10);
  }

  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function addDaysISO(iso, days) {
    const d = new Date(iso + 'T12:00:00');
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function diffDays(isoA, isoB) { // A - B em dias
    return Math.round((new Date(isoA + 'T12:00:00') - new Date(isoB + 'T12:00:00')) / 86400000);
  }

  /* --- regra de decisão (ILAC G8) ------------------------------------------ */

  // regra: 'simples' | 'guarda' | 'tur'
  function evaluate(erro, U, ema, regra) {
    const e = Math.abs(Number(erro) || 0);
    const u = Math.abs(Number(U) || 0);
    const limite = regra === 'guarda' ? ema - u : ema;
    const tur = u > 0 ? ema / u : Infinity;
    let ok = e <= limite + 1e-12;
    if (regra === 'tur') ok = ok && tur >= 4;
    return { ok: ok, limite: limite, tur: tur };
  }

  /* --- consultas montadas --------------------------------------------------- */

  async function loadAll() {
    const [instrumentos, padroes, aplicacoes, vinculos, calibracoes, pontos, calpadroes,
           agenda, ocorrencias, usuarios] = await Promise.all([
      DB.table('instrumentos'), DB.table('padroes'), DB.table('aplicacoes'),
      DB.table('vinculos'), DB.table('calibracoes'), DB.table('pontos'),
      DB.table('calpadroes'), DB.table('agenda'), DB.table('ocorrencias'), DB.table('usuarios')
    ]);
    calibracoes.forEach(c => { c.Data = normDate(c.Data); c.DataAssinatura = c.DataAssinatura ? String(c.DataAssinatura).slice(0, 16) : null; });
    instrumentos.forEach(i => { i.UltimaCal = normDate(i.UltimaCal); i.ProximaCal = normDate(i.ProximaCal); });
    padroes.forEach(p => { p.DataCal = normDate(p.DataCal); p.Validade = normDate(p.Validade); });
    agenda.forEach(a => { a.DataPrevista = normDate(a.DataPrevista); });
    ocorrencias.forEach(o => { o.Data = normDate(o.Data); });
    return { instrumentos, padroes, aplicacoes, vinculos, calibracoes, pontos, calpadroes,
             agenda, ocorrencias, usuarios };
  }

  function pointsOf(pontos, calId) {
    return pontos.filter(p => String(p.Calibracao) === String(calId))
      .sort((a, b) => Number(a.Ordem) - Number(b.Ordem));
  }

  function standardsOf(calpadroes, calId) {
    return calpadroes.filter(r => String(r.Calibracao) === String(calId)).map(r => r.Padrao);
  }

  function calibrationsOf(calibracoes, instId) {
    return calibracoes.filter(c => String(c.Instrumento) === String(instId))
      .sort((a, b) => String(b.Data).localeCompare(String(a.Data)));
  }

  function lastSigned(calibracoes, instId) {
    const list = calibrationsOf(calibracoes, instId).filter(c => c.Status === 'Assinada');
    return list[0] || null;
  }

  function linksOf(vinculos, instId) {
    return vinculos.filter(v => String(v.Instrumento) === String(instId) && String(v.Ativo) !== '0');
  }

  /* --- conformidade instrumento × aplicação -------------------------------- */

  // Avalia os pontos da última calibração assinada dentro da faixa de uso da
  // aplicação, com a regra de decisão da aplicação (ou a padrão do sistema).
  function appStatus(data, instId, app, regraPadrao) {
    const cal = lastSigned(data.calibracoes, instId);
    if (!cal) return { status: 'none', motivo: 'Sem calibração assinada' };

    const regra = app.Regra || regraPadrao;
    const pts = pointsOf(data.pontos, cal.ID).filter(p => {
      const n = Number(p.Nominal);
      const min = app.FaixaMin !== null && app.FaixaMin !== '' ? Number(app.FaixaMin) : -Infinity;
      const max = app.FaixaMax !== null && app.FaixaMax !== '' ? Number(app.FaixaMax) : Infinity;
      return n >= min && n <= max;
    });
    if (!pts.length) return { status: 'none', motivo: 'Sem pontos na faixa de uso' };

    const ema = Number(app.EMA);
    let worst = null;
    let okCount = 0;
    pts.forEach(p => {
      const r = evaluate(p.Erro, p.U, ema, regra);
      if (r.ok) okCount++;
      if (!worst || Math.abs(Number(p.Erro)) > Math.abs(Number(worst.p.Erro))) worst = { p, r };
    });

    const status = okCount === pts.length ? 'ok' : (okCount === 0 ? 'no' : 'part');
    return {
      status: status, cal: cal, regra: regra, pontos: pts.length, atendidos: okCount,
      pior: worst ? {
        nominal: worst.p.Nominal, erro: Number(worst.p.Erro), U: Number(worst.p.U),
        ema: ema, limite: worst.r.limite, ok: worst.r.ok
      } : null
    };
  }

  // Resultado do instrumento = síntese das aplicações vinculadas.
  function instrumentResult(data, instId, regraPadrao) {
    const links = linksOf(data.vinculos, instId);
    if (!links.length) return null;
    let ok = 0, no = 0;
    links.forEach(v => {
      const app = data.aplicacoes.find(a => String(a.ID) === String(v.Aplicacao));
      if (!app) return;
      const st = appStatus(data, instId, app, regraPadrao).status;
      if (st === 'ok') ok++;
      else if (st === 'no' || st === 'part') no++;
    });
    if (no === 0 && ok > 0) return 'Aprovado';
    if (ok > 0 && no > 0) return 'Aprovado c/ restrição';
    if (no > 0 && ok === 0) return 'Reprovado';
    return null;
  }

  function dueStatus(inst, diasAlerta) {
    if (inst.Status === 'Baixado') return { label: '—', kind: 'mute' };
    if (!inst.ProximaCal) return { label: 'Sem data', kind: 'mute' };
    const d = diffDays(inst.ProximaCal, todayISO());
    if (d < 0) return { label: 'Vencida', kind: 'err', dias: -d };
    if (d <= diasAlerta) return { label: 'A vencer', kind: 'warn', dias: d };
    return { label: 'Em dia', kind: 'ok', dias: d };
  }

  /* --- deriva (tendência do erro em um ponto) -------------------------------- */

  function deriva(data, instId, nominal) {
    const cals = calibrationsOf(data.calibracoes, instId).filter(c => c.Status === 'Assinada');
    const serie = [];
    cals.slice().reverse().forEach(c => { // cronológica
      const pts = pointsOf(data.pontos, c.ID);
      const p = pts.find(x => Number(x.Nominal) === Number(nominal));
      if (p) serie.push({ data: c.Data, erro: Number(p.Erro), cal: c.ID });
    });
    if (serie.length < 2) return { serie: serie };

    // regressão linear simples sobre o tempo (em anos)
    const t0 = new Date(serie[0].data + 'T12:00:00').getTime();
    const xs = serie.map(s => (new Date(s.data + 'T12:00:00').getTime() - t0) / (365.25 * 86400000));
    const ys = serie.map(s => s.erro);
    const n = xs.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
    let sxx = 0, sxy = 0;
    for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) * (xs[i] - mx); sxy += (xs[i] - mx) * (ys[i] - my); }
    const slope = sxx > 0 ? sxy / sxx : 0; // unidade por ano

    const ultimo = ys[n - 1];
    return { serie: serie, slopeAno: slope, ultimo: ultimo };
  }

  /* --- impacto de um padrão reprovado ---------------------------------------- */

  function impactoPadrao(data, padraoId) {
    const calIds = data.calpadroes.filter(r => String(r.Padrao) === String(padraoId)).map(r => r.Calibracao);
    const cals = data.calibracoes.filter(c => calIds.indexOf(c.ID) >= 0)
      .sort((a, b) => String(b.Data).localeCompare(String(a.Data)));
    const instIds = [];
    cals.forEach(c => { if (instIds.indexOf(c.Instrumento) < 0) instIds.push(c.Instrumento); });
    return { calibracoes: cals, instrumentos: instIds };
  }

  /* --- alertas do dashboard ---------------------------------------------------- */

  async function alertas(data, diasAlerta) {
    const out = [];
    const hoje = todayISO();

    data.padroes.forEach(p => {
      if (p.Status === 'Reprovado') {
        const imp = impactoPadrao(data, p.ID);
        out.push({
          tipo: 'padrao', sev: 'r',
          texto: 'Padrão ' + p.ID + ' reprovado — ' + imp.instrumentos.length + ' instrumento(s) impactado(s)',
          ref: '#/padroes/' + p.ID
        });
      } else if (p.Validade) {
        const d = diffDays(p.Validade, hoje);
        if (d < 0) out.push({ tipo: 'cert', sev: 'r', texto: 'Certificado do padrão ' + p.ID + ' vencido', ref: '#/padroes/' + p.ID });
        else if (d <= diasAlerta) out.push({ tipo: 'cert', sev: 'b', texto: 'Certificado do padrão ' + p.ID + ' vence em ' + d + ' dia(s)', ref: '#/padroes/' + p.ID });
      }
    });

    data.instrumentos.forEach(i => {
      if (i.Status === 'Bloqueado') {
        out.push({ tipo: 'bloqueio', sev: 'r', texto: i.ID + ' bloqueado(a) após reprovação na calibração', ref: '#/instrumentos/' + i.ID });
      }
      if (i.Status !== 'Baixado' && i.ProximaCal) {
        const d = diffDays(i.ProximaCal, hoje);
        if (d < 0) out.push({ tipo: 'vencido', sev: 'a', texto: i.ID + ' com calibração vencida há ' + (-d) + ' dia(s)', ref: '#/instrumentos/' + i.ID });
      }
    });

    // deriva: erro projetado cruza o menor EMA vinculado antes da próxima calibração
    data.instrumentos.forEach(i => {
      if (i.Status !== 'Ativo') return;
      const links = linksOf(data.vinculos, i.ID);
      if (!links.length || !i.ProximaCal) return;
      const emas = links.map(v => {
        const app = data.aplicacoes.find(a => String(a.ID) === String(v.Aplicacao));
        return app ? Number(app.EMA) : null;
      }).filter(x => x !== null);
      if (!emas.length) return;
      const emaCrit = Math.min.apply(null, emas);
      const cal = lastSigned(data.calibracoes, i.ID);
      if (!cal) return;
      const pts = pointsOf(data.pontos, cal.ID);
      pts.forEach(p => {
        const dv = deriva(data, i.ID, p.Nominal);
        if (!dv.slopeAno || dv.slopeAno <= 0 || dv.serie.length < 3) return;
        const anosRestantes = diffDays(i.ProximaCal, hoje) / 365.25;
        const projetado = dv.ultimo + dv.slopeAno * anosRestantes;
        if (dv.ultimo < emaCrit && Math.abs(projetado) >= emaCrit) {
          out.push({
            tipo: 'deriva', sev: 'a',
            texto: 'Deriva detectada no ponto de ' + p.Nominal + ' ' + (i.Unidade || '') + ' do ' + i.ID,
            ref: '#/instrumentos/' + i.ID + '/historico'
          });
        }
      });
    });

    const rank = { r: 0, a: 1, b: 2 };
    return out.sort((a, b) => rank[a.sev] - rank[b.sev]);
  }

  return {
    normDate, todayISO, addDaysISO, diffDays, evaluate,
    loadAll, pointsOf, standardsOf, calibrationsOf, lastSigned, linksOf,
    appStatus, instrumentResult, dueStatus, deriva, impactoPadrao, alertas
  };
})();
