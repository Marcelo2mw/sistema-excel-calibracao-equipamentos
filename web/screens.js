/* ===========================================================================
 * MetroCal — telas
 * Cada função recebe (view, params) e renderiza a tela. Os dados vêm sempre
 * frescos das abas via ctx(); as escritas passam por DB.* e registram na
 * Auditoria.
 * ======================================================================== */
'use strict';

const Screens = (function () {

  const h = UI.h, esc = UI.esc, icon = UI.icon;
  const fmtNum = UI.fmtNum, fmtSigned = UI.fmtSigned, fmtDate = UI.fmtDate, fmtDateTime = UI.fmtDateTime;

  async function ctx() {
    const data = await Domain.loadAll();
    data.regraPadrao = (await DB.config('regraPadrao')) || 'guarda';
    data.diasAlerta = parseInt((await DB.config('diasAlerta')) || '30', 10);
    data.k = parseInt((await DB.config('k')) || '2', 10);
    data.usuario = await DB.currentUser();
    data.documentos = await DB.table('documentos');
    data.auditoria = await DB.table('auditoria');
    return data;
  }

  function q(view, sel) { return view.querySelector(sel); }
  function qa(view, sel) { return Array.from(view.querySelectorAll(sel)); }

  async function photoHtml(inst, cls) {
    const url = inst && inst.Foto ? await Files.readDataUrl(inst.Foto) : null;
    if (url) return '<img class="' + (cls || 'thumb') + '" src="' + url + '" alt="">';
    return '<span class="' + (cls || 'thumb') + '-ph">' + icon('camera') + '</span>';
  }

  function faixaTxt(i) {
    if (i.FaixaMin === null && i.FaixaMax === null) return '—';
    return fmtNum(i.FaixaMin, 0) + '–' + fmtNum(i.FaixaMax, 0) + ' ' + (i.Unidade || '');
  }

  function resultadoChip(r) { return r ? UI.chip(r) : '<span class="chip mute">—</span>'; }

  /* =========================================================================
   * DASHBOARD
   * ====================================================================== */

  async function dashboard(view) {
    const data = await ctx();
    const hoje = Domain.todayISO();

    const ativos = data.instrumentos.filter(i => i.Status === 'Ativo');
    const emCal = data.instrumentos.filter(i => i.Status === 'Em calibração');
    const vencidos = data.instrumentos.filter(i =>
      i.Status !== 'Baixado' && i.ProximaCal && Domain.diffDays(i.ProximaCal, hoje) < 0);
    const aVencer = data.instrumentos.filter(i => {
      if (i.Status === 'Baixado' || !i.ProximaCal) return false;
      const d = Domain.diffDays(i.ProximaCal, hoje);
      return d >= 0 && d <= data.diasAlerta;
    });

    const anoAtras = Domain.addDaysISO(hoje, -365);
    const cals12 = data.calibracoes.filter(c => c.Data >= anoAtras);
    const reprov = cals12.filter(c => c.Resultado === 'Reprovado').length;
    const taxa = cals12.length ? (100 * reprov / cals12.length) : 0;

    // calibrações por mês — últimos 6 meses
    const meses = [], realizadas = [], reprovadas = [];
    const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    for (let m = 5; m >= 0; m--) {
      const dref = new Date(); dref.setDate(1); dref.setMonth(dref.getMonth() - m);
      const chave = dref.getFullYear() + '-' + String(dref.getMonth() + 1).padStart(2, '0');
      meses.push(nomes[dref.getMonth()]);
      const doMes = data.calibracoes.filter(c => String(c.Data).slice(0, 7) === chave);
      realizadas.push(doMes.length);
      reprovadas.push(doMes.filter(c => c.Resultado === 'Reprovado').length);
    }

    // por grandeza
    const porGrandeza = {};
    data.instrumentos.forEach(i => { const g = i.Grandeza || 'Outra'; porGrandeza[g] = (porGrandeza[g] || 0) + 1; });
    const slices = Object.keys(porGrandeza).map(g => ({ label: g, value: porGrandeza[g] }));

    // próximas calibrações
    const proximas = data.instrumentos
      .filter(i => i.Status !== 'Baixado' && i.ProximaCal)
      .sort((a, b) => a.ProximaCal.localeCompare(b.ProximaCal))
      .slice(0, 6);

    const alertas = await Domain.alertas(data, data.diasAlerta);
    App.setBell(alertas, data);

    view.innerHTML =
      '<div class="kpis">' +
        kpi('wrench', 'b', 'Instrumentos ativos', ativos.length, emCal.length + ' em calibração') +
        kpi('alert', 'r', 'Calibrações vencidas', vencidos.length, vencidos.length ? 'ação imediata' : 'nenhuma', vencidos.length > 0) +
        kpi('clock', 'a', 'A vencer em ' + data.diasAlerta + ' dias', aVencer.length, aVencer.length ? 'agendar' : 'nenhuma') +
        kpi('check', 'g', 'Taxa de reprovação', fmtNum(taxa, 1).replace('.', ',') + '%', 'últimos 12 meses', false, true) +
      '</div>' +

      '<div class="cols cols-31">' +
        '<div class="card"><div class="card-hd"><h3>Calibrações por mês</h3></div>'
          + UI.chartBars({ labels: meses, series: [
              { name: 'Realizadas', color: '#1668b4', values: realizadas },
              { name: 'Reprovadas', color: '#cf4040', values: reprovadas } ] })
          + UI.legend([{ label: 'Realizadas', color: '#1668b4' }, { label: 'Reprovadas', color: '#cf4040' }]) +
        '</div>' +
        '<div class="card"><div class="card-hd"><h3>Instrumentos por grandeza</h3></div>'
          + UI.chartDonut(slices)
          + UI.legend(slices.map((s, i) => ({ label: s.label, color: UI.CHART_COLORS[i % UI.CHART_COLORS.length] }))) +
        '</div>' +
      '</div>' +

      '<div class="cols cols-31">' +
        '<div class="card"><div class="card-hd"><h3>Próximas calibrações</h3>' +
          '<a class="link" href="#/agenda">ver agenda →</a></div>' +
          '<table class="tbl"><thead><tr><th>Instrumento</th><th>Descrição</th><th>Vencimento</th><th>Responsável</th><th>Situação</th></tr></thead><tbody>' +
          (proximas.length ? proximas.map(i => {
            const due = Domain.dueStatus(i, data.diasAlerta);
            const sit = i.Status === 'Bloqueado' ? 'Bloqueado' : due.label;
            return '<tr data-go="#/instrumentos/' + esc(i.ID) + '">' +
              '<td class="rowid">' + esc(i.ID) + '</td><td>' + esc(i.Descricao) + '</td>' +
              '<td class="' + (due.kind === 'err' ? 'bad' : '') + '">' + fmtDate(i.ProximaCal) + '</td>' +
              '<td>' + esc(i.Responsavel || '—') + '</td><td>' + UI.chip(sit) + '</td></tr>';
          }).join('') : '<tr><td colspan="5" class="muted">Nenhuma calibração prevista.</td></tr>') +
          '</tbody></table>' +
        '</div>' +
        '<div class="card"><div class="card-hd"><h3>Alertas</h3></div><div class="alist">' +
          (alertas.length ? alertas.slice(0, 6).map(a =>
            '<div class="aitem" data-go="' + esc(a.ref) + '"><span class="aic ' + a.sev + '">'
            + icon(a.tipo === 'deriva' ? 'trend' : a.tipo === 'cert' ? 'file' : a.tipo === 'vencido' ? 'clock' : a.tipo === 'bloqueio' ? 'ban' : 'alert')
            + '</span><div class="atxt"><b>' + esc(a.texto) + '</b></div></div>').join('')
            : '<div class="empty">Nenhum alerta no momento.</div>') +
        '</div></div>' +
      '</div>';

    qa(view, '[data-go]').forEach(el => el.addEventListener('click', () =>
      App.go(el.getAttribute('data-go').replace(/^#?\//, ''))));
  }

  function kpi(ic, cor, label, valor, sub, subBad, subGood) {
    return '<div class="kpi"><span class="ic ' + cor + '">' + icon(ic) + '</span><div>' +
      '<div class="lbl">' + esc(label) + '</div>' +
      '<div class="val">' + valor + '</div>' +
      '<div class="sub' + (subBad ? ' bad' : subGood ? ' good' : '') + '">' + esc(sub) + '</div></div></div>';
  }

  /* =========================================================================
   * INSTRUMENTOS — lista
   * ====================================================================== */

  const PAGE = 9;

  async function instrumentos(view, params) {
    const data = await ctx();
    let filtro = (params && params.q) || '';
    let fGrandeza = 'todas', fStatus = 'todos', fLocal = 'todas';
    let pagina = 1;

    const grandezas = [...new Set(data.instrumentos.map(i => i.Grandeza).filter(Boolean))];
    const locais = [...new Set(data.instrumentos.map(i => i.Localizacao).filter(Boolean))];

    view.innerHTML =
      '<div class="filters">' +
        '<label class="search">' + icon('search') +
          '<input id="fQ" type="text" placeholder="Buscar por ID, descrição, nº de série…" value="' + esc(filtro) + '"></label>' +
        '<select class="in" id="fG"><option value="todas">Grandeza: todas</option>' +
          grandezas.map(g => '<option>' + esc(g) + '</option>').join('') + '</select>' +
        '<select class="in" id="fS"><option value="todos">Status: todos</option>' +
          ['Ativo', 'Em calibração', 'Bloqueado', 'Baixado'].map(s => '<option>' + s + '</option>').join('') + '</select>' +
        '<select class="in" id="fL"><option value="todas">Localização: todas</option>' +
          locais.map(l => '<option>' + esc(l) + '</option>').join('') + '</select>' +
        '<div class="grow" style="flex:1"></div>' +
        '<button class="btn solid" id="btnNew">' + icon('plus') + ' Novo instrumento</button>' +
      '</div>' +
      '<div class="card" style="padding:6px 0 0">' +
        '<table class="tbl"><thead><tr><th style="width:60px"></th><th>ID</th><th>Instrumento</th>' +
        '<th>Fabricante / Modelo</th><th>Grandeza</th><th>Faixa</th><th>Próx. calibração</th><th>Status</th>' +
        '<th style="width:90px"></th></tr></thead><tbody id="rows"></tbody></table>' +
        '<div class="pagefoot" style="padding:10px 16px"><span class="muted" id="count"></span>' +
        '<div class="row"><a class="link" id="btnCsv">Exportar CSV</a></div><div class="pg" id="pg"></div></div>' +
      '</div>';

    async function draw() {
      const termo = filtro.toLowerCase();
      const list = data.instrumentos.filter(i => {
        if (fGrandeza !== 'todas' && i.Grandeza !== fGrandeza) return false;
        if (fStatus !== 'todos' && i.Status !== fStatus) return false;
        if (fLocal !== 'todas' && i.Localizacao !== fLocal) return false;
        if (termo && !(String(i.ID) + ' ' + i.Descricao + ' ' + (i.NumSerie || '') + ' ' + (i.Modelo || '')).toLowerCase().includes(termo)) return false;
        return true;
      });

      const pages = Math.max(1, Math.ceil(list.length / PAGE));
      if (pagina > pages) pagina = pages;
      const slice = list.slice((pagina - 1) * PAGE, pagina * PAGE);

      const rows = [];
      for (const i of slice) {
        const due = Domain.dueStatus(i, data.diasAlerta);
        rows.push('<tr data-id="' + esc(i.ID) + '">' +
          '<td>' + (await photoHtml(i)) + '</td>' +
          '<td class="rowid">' + esc(i.ID) + '</td>' +
          '<td>' + esc(i.Descricao) + '</td>' +
          '<td class="muted">' + esc((i.Fabricante || '') + ' ' + (i.Modelo || '')) + '</td>' +
          '<td>' + esc(i.Grandeza || '—') + '</td>' +
          '<td>' + faixaTxt(i) + '</td>' +
          '<td class="' + (due.kind === 'err' ? 'bad' : '') + '">' + (i.ProximaCal ? fmtDate(i.ProximaCal) : '—') + '</td>' +
          '<td>' + UI.chip(i.Status) + '</td>' +
          '<td class="nowrap"><button class="iconbtn" data-hist="' + esc(i.ID) + '" title="Histórico e carta de controle">' + icon('history') + '</button>' +
          '<button class="iconbtn" data-open="' + esc(i.ID) + '" title="Abrir cadastro">' + icon('edit') + '</button></td>' +
        '</tr>');
      }
      q(view, '#rows').innerHTML = rows.join('') || '<tr><td colspan="9" class="empty">Nenhum instrumento encontrado.</td></tr>';
      q(view, '#count').textContent = list.length + ' de ' + data.instrumentos.length + ' instrumentos';

      const pg = q(view, '#pg');
      pg.innerHTML = '';
      pg.appendChild(h('button', { html: '‹', onclick: () => { pagina--; draw(); }, disabled: pagina <= 1 ? '' : null }));
      for (let p = 1; p <= pages; p++) {
        pg.appendChild(h('button', { text: String(p), class: p === pagina ? 'on' : '', onclick: () => { pagina = p; draw(); } }));
      }
      pg.appendChild(h('button', { html: '›', onclick: () => { pagina++; draw(); }, disabled: pagina >= pages ? '' : null }));

      qa(view, 'tr[data-id]').forEach(tr => tr.addEventListener('click', e => {
        if (e.target.closest('button')) return;
        App.go('instrumentos/' + tr.getAttribute('data-id'));
      }));
      qa(view, '[data-hist]').forEach(b => b.addEventListener('click', () => App.go('instrumentos/' + b.getAttribute('data-hist') + '/historico')));
      qa(view, '[data-open]').forEach(b => b.addEventListener('click', () => App.go('instrumentos/' + b.getAttribute('data-open'))));
    }

    q(view, '#fQ').addEventListener('input', e => { filtro = e.target.value; pagina = 1; draw(); });
    q(view, '#fG').addEventListener('change', e => { fGrandeza = e.target.value; pagina = 1; draw(); });
    q(view, '#fS').addEventListener('change', e => { fStatus = e.target.value; pagina = 1; draw(); });
    q(view, '#fL').addEventListener('change', e => { fLocal = e.target.value; pagina = 1; draw(); });
    q(view, '#btnNew').addEventListener('click', () => App.go('instrumentos/novo'));
    q(view, '#btnCsv').addEventListener('click', () => {
      const header = DB.SHEETS.instrumentos.cols;
      const linhas = data.instrumentos.map(i => header.map(c => i[c]));
      App.downloadCsv('instrumentos.csv', [header].concat(linhas));
    });

    await draw();
  }

  /* =========================================================================
   * INSTRUMENTO — cadastro / detalhe
   * ====================================================================== */

  async function instrumento(view, id) {
    const isNew = id === 'novo';
    const data = await ctx();
    const inst = isNew ? {
      ID: await DB.nextSeqId('INS', 'instrumentos'), Descricao: '', Fabricante: '', Modelo: '',
      NumSerie: '', Localizacao: '', Responsavel: data.usuario, Status: 'Ativo', Grandeza: 'Dimensional',
      Unidade: 'mm', FaixaMin: 0, FaixaMax: 0, Resolucao: null, Classe: '', Saida: '',
      IntervaloMeses: 12, UltimaCal: null, ProximaCal: null, Foto: null, Obs: ''
    } : data.instrumentos.find(i => String(i.ID) === String(id));

    if (!inst) { view.innerHTML = '<div class="empty">Instrumento não encontrado.</div>'; return; }

    App.setTitle(isNew ? 'Instrumentos · Novo' : 'Instrumentos · ' + inst.ID + ' · Cadastro',
      isNew ? 'Novo instrumento' : inst.ID + (inst.Descricao ? ' — ' + inst.Descricao : ''));

    const cals = Domain.calibrationsOf(data.calibracoes, inst.ID);
    const links = Domain.linksOf(data.vinculos, inst.ID);
    const docs = data.documentos.filter(dc => String(dc.EntidadeID) === String(inst.ID));
    const due = Domain.dueStatus(inst, data.diasAlerta);
    const resultado = Domain.instrumentResult(data, inst.ID, data.regraPadrao);
    const grandezas = ['Dimensional', 'Temperatura', 'Pressão', 'Massa', 'Torque', 'Elétrica', 'Fotométrica', 'Vazão', 'Outra'];

    const fotoUrl = inst.Foto ? await Files.readDataUrl(inst.Foto) : null;

    view.innerHTML =
      '<div class="id-grid">' +

      /* coluna 1: foto, situação, documentos */
      '<div>' +
        '<div class="card">' +
          '<div class="photo" id="photoBox">' +
            (fotoUrl ? '<img src="' + fotoUrl + '" alt="">' : icon('camera')) +
            '<button class="cam" id="btnFoto" title="Trocar foto">' + icon('camera') + '</button>' +
          '</div>' +
          '<div class="photo-cap"><b>' + esc(inst.ID) + '</b><span>' + esc(inst.Descricao || 'Novo instrumento') +
            (inst.FaixaMax !== null ? ' · ' + faixaTxt(inst) : '') + '</span></div>' +
        '</div>' +

        '<div class="card"><div class="card-hd"><h3>Situação</h3>' + (resultado ? UI.chip(resultado) : '') + '</div>' +
          '<dl class="kv">' +
            '<dt>Status</dt><dd>' + UI.chip(inst.Status) + '</dd>' +
            '<dt>Última calibração</dt><dd>' + fmtDate(inst.UltimaCal) + '</dd>' +
            '<dt>Próxima calibração</dt><dd>' + fmtDate(inst.ProximaCal) + '</dd>' +
          '</dl>' +
          (inst.ProximaCal ? '<div class="mt">' + UI.chip(due.label + (due.dias !== undefined ? (due.kind === 'err' ? ' há ' + due.dias + ' d' : ' · em ' + due.dias + ' d') : '')) + '</div>' : '') +
          '<div class="mt" id="btnBlockBox"></div>' +
        '</div>' +

        '<div class="card"><div class="card-hd"><h3>Documentos</h3></div><div class="doclist" id="docs">' +
          docs.map(dc => '<div class="ditem" data-doc="' + esc(dc.Ref) + '">' + icon('file') + esc(dc.Nome) + '</div>').join('') +
          cals.filter(c => c.CertificadoRef).map(c =>
            '<div class="ditem" data-doc="' + esc(c.CertificadoRef) + '">' + icon('file') + 'Certificado ' + esc(c.ID) + '</div>').join('') +
        '</div>' +
        '<button class="btn ghost sm mt" id="btnDoc">' + icon('upload') + ' Enviar documento</button></div>' +
      '</div>' +

      /* coluna 2: dados */
      '<div>' +
        '<div class="card"><div class="card-hd"><h3>Dados gerais</h3></div><div class="fgrid c2">' +
          fld('Identificação', 'fID', inst.ID, isNew ? '' : 'disabled') +
          fld('Fabricante', 'fFab', inst.Fabricante) +
          fld('Modelo', 'fMod', inst.Modelo) +
          fld('Nº de série', 'fSN', inst.NumSerie) +
          fld('Localização', 'fLoc', inst.Localizacao) +
          fld('Responsável', 'fResp', inst.Responsavel) +
        '</div></div>' +

        '<div class="card"><div class="card-hd"><h3>Dados metrológicos</h3></div><div class="fgrid c3">' +
          '<label class="f"><span>Descrição</span><input class="in" id="fDesc" value="' + esc(inst.Descricao) + '"></label>' +
          '<label class="f"><span>Grandeza</span><select class="in" id="fGr">' +
            grandezas.map(g => '<option' + (g === inst.Grandeza ? ' selected' : '') + '>' + g + '</option>').join('') + '</select></label>' +
          '<label class="f"><span>Unidade</span><input class="in" id="fUn" value="' + esc(inst.Unidade) + '"></label>' +
          fld('Faixa mín.', 'fFmin', inst.FaixaMin) +
          fld('Faixa máx.', 'fFmax', inst.FaixaMax) +
          fld('Resolução', 'fRes', inst.Resolucao) +
          fld('Classe / exatidão', 'fClasse', inst.Classe) +
          fld('Saída', 'fSaida', inst.Saida) +
        '</div></div>' +

        '<div class="card"><div class="card-hd"><h3>Calibração</h3></div><div class="fgrid c3">' +
          fld('Intervalo (meses)', 'fInt', inst.IntervaloMeses) +
          fld('Última', 'fUlt', inst.UltimaCal, 'disabled') +
          fld('Próxima', 'fProx', inst.ProximaCal, 'disabled') +
        '</div>' +
        '<label class="f"><span>Observações</span><textarea class="in" id="fObs">' + esc(inst.Obs || '') + '</textarea></label>' +
        '<div class="row end"><button class="btn solid" id="btnSave">' + icon('check') + ' Salvar cadastro</button></div></div>' +
      '</div>' +

      /* coluna 3: aplicações, histórico, ações */
      '<div class="id-right">' +
        '<div class="card"><div class="card-hd"><h3>Aplicações vinculadas</h3>' + (resultado ? UI.chip(resultado) : '') + '</div>' +
          '<div id="appLinks">' +
          (links.length ? links.map(v => {
            const app = data.aplicacoes.find(a => String(a.ID) === String(v.Aplicacao));
            if (!app) return '';
            const st = Domain.appStatus(data, inst.ID, app, data.regraPadrao);
            const lbl = st.status === 'ok' ? 'Atende' : st.status === 'part' ? 'Atende parcialmente' : st.status === 'no' ? 'Não atende' : 'Sem calibração';
            return '<div class="card" style="margin-bottom:8px;padding:10px 12px;box-shadow:none">' +
              '<div class="row between"><div><b>' + esc(app.ID) + ' · EMA ' + fmtNum(app.EMA) + ' ' + esc(app.Unidade) + '</b>' +
              '<div class="muted" style="font-size:11px">' + esc(app.Descricao) + '</div></div>' +
              UI.chip(lbl) + '</div></div>';
          }).join('') : '<div class="empty">Nenhuma aplicação vinculada.</div>') +
          '</div>' +
          '<button class="link" id="btnLinks">Gerenciar vínculos →</button>' +
        '</div>' +

        '<div class="card"><div class="card-hd"><h3>Histórico de calibrações</h3>' +
          '<a class="link" href="#/instrumentos/' + esc(inst.ID) + '/historico">carta de controle →</a></div>' +
          (cals.length ? cals.map(c =>
            '<div class="row between" style="padding:7px 0;border-bottom:1px solid var(--line-soft);cursor:pointer" data-cal="' + esc(c.ID) + '">' +
            '<div><b>' + fmtDate(c.Data) + '</b><div class="muted" style="font-size:11px">' + esc(c.ID) + '</div></div>' +
            resultadoChip(c.Resultado) + '</div>').join('')
            : '<div class="empty">Nenhuma calibração registrada.</div>') +
        '</div>' +

        '<div class="card"><div class="card-hd"><h3>Ações</h3></div>' +
          '<button class="btn solid block" id="btnCal">' + icon('cals') + ' Registrar calibração</button>' +
          '<div class="row mt">' +
            '<button class="btn" id="btnAgenda" style="flex:1">' + icon('calendar') + ' Agendar</button>' +
            '<button class="btn" id="btnManut" style="flex:1">' + icon('wrench') + ' Manutenção</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '</div>';

    /* --- comportamentos ------------------------------------------------------ */

    const blockBox = q(view, '#btnBlockBox');
    if (inst.Status === 'Bloqueado') {
      blockBox.appendChild(h('button', { class: 'btn block', html: icon('check') + ' Desbloquear instrumento',
        onclick: () => mudaStatus('Ativo', 'Desbloqueio') }));
    } else if (inst.Status !== 'Baixado') {
      blockBox.appendChild(h('button', { class: 'btn danger block', html: icon('ban') + ' Bloquear instrumento',
        onclick: () => mudaStatus('Bloqueado', 'Bloqueio') }));
    }
    if (!isNew && inst.Status !== 'Baixado') {
      blockBox.appendChild(h('button', { class: 'btn ghost block mt', html: icon('download') + ' Baixar do sistema',
        onclick: () => mudaStatus('Baixado', 'Baixa') }));
    }

    async function mudaStatus(novo, acao) {
      if (!(await UI.confirmBox(acao + ' do instrumento ' + inst.ID + '?', acao))) return;
      await DB.update('instrumentos', inst.ID, { Status: novo });
      await DB.insert('ocorrencias', {
        ID: await DB.nextSeqId('OC', 'ocorrencias'), Data: Domain.todayISO(), Instrumento: inst.ID,
        Tipo: acao, Descricao: acao + ' registrada pelo painel.', Responsavel: data.usuario, Status: 'Encerrada'
      });
      await DB.audit(acao, 'Instrumento', inst.ID, 'Status → ' + novo);
      UI.toast(acao + ' registrada.');
      instrumento(view, inst.ID);
    }

    q(view, '#btnSave').addEventListener('click', async () => {
      const patch = {
        Descricao: q(view, '#fDesc').value.trim(), Fabricante: q(view, '#fFab').value.trim(),
        Modelo: q(view, '#fMod').value.trim(), NumSerie: q(view, '#fSN').value.trim(),
        Localizacao: q(view, '#fLoc').value.trim(), Responsavel: q(view, '#fResp').value.trim(),
        Grandeza: q(view, '#fGr').value, Unidade: q(view, '#fUn').value.trim(),
        FaixaMin: num(q(view, '#fFmin').value), FaixaMax: num(q(view, '#fFmax').value),
        Resolucao: num(q(view, '#fRes').value), Classe: q(view, '#fClasse').value.trim(),
        Saida: q(view, '#fSaida').value.trim(),
        IntervaloMeses: num(q(view, '#fInt').value) || 12, Obs: q(view, '#fObs').value.trim()
      };
      if (!patch.Descricao) { UI.toast('Informe a descrição do instrumento.', 'err'); return; }
      if (isNew) {
        patch.Status = 'Ativo';
        await DB.insert('instrumentos', Object.assign({}, inst, patch));
        await DB.audit('Cadastro', 'Instrumento', inst.ID, 'Instrumento cadastrado: ' + patch.Descricao);
        UI.toast('Instrumento ' + inst.ID + ' cadastrado.');
        App.go('instrumentos/' + inst.ID);
      } else {
        await DB.update('instrumentos', inst.ID, patch);
        await DB.audit('Edição', 'Instrumento', inst.ID, 'Cadastro atualizado.');
        UI.toast('Cadastro salvo.');
        instrumento(view, inst.ID);
      }
    });

    q(view, '#btnFoto').addEventListener('click', async () => {
      if (isNew) { UI.toast('Salve o cadastro antes de anexar a foto.', 'err'); return; }
      const f = await UI.pickFile('image/*', true);
      if (!f) return;
      if (inst.Foto) { try { await Files.remove(inst.Foto); } catch (e) {} } // remove a foto antiga (inclusive a .jpg com fundo preto)
      const ref = await Files.save(inst.ID + '.png', f.base64);
      await DB.update('instrumentos', inst.ID, { Foto: ref });
      await DB.audit('Foto', 'Instrumento', inst.ID, 'Foto atualizada.');
      UI.toast('Foto gravada.');
      instrumento(view, inst.ID);
    });

    q(view, '#btnDoc').addEventListener('click', async () => {
      const f = await UI.pickFile('.pdf,.jpg,.jpeg,.png', false);
      if (!f) return;
      const nome = inst.ID + '-' + f.name;
      const ref = await Files.save(nome, f.base64);
      await DB.insert('documentos', {
        ID: await DB.nextSeqId('DOC', 'documentos'), Entidade: 'Instrumento',
        EntidadeID: inst.ID, Nome: f.name, Ref: ref
      });
      await DB.audit('Documento', 'Instrumento', inst.ID, 'Anexado: ' + f.name);
      UI.toast('Documento anexado.');
      if (!isNew) instrumento(view, inst.ID);
    });

    qa(view, '[data-doc]').forEach(el => el.addEventListener('click', async () => {
      try { await Files.open(el.getAttribute('data-doc')); }
      catch (e) { UI.toast('Não foi possível abrir: ' + e.message, 'err'); }
    }));

    q(view, '#btnLinks').addEventListener('click', () => manageLinks(inst));
    q(view, '#btnCal').addEventListener('click', () => {
      if (isNew) { UI.toast('Salve o cadastro antes de calibrar.', 'err'); return; }
      App.go('calibracoes/nova/' + inst.ID);
    });
    q(view, '#btnAgenda').addEventListener('click', () => scheduleModal(inst));
    q(view, '#btnManut').addEventListener('click', () => maintenanceModal(inst));
    qa(view, '[data-cal]').forEach(el => el.addEventListener('click', () => App.go('calibracoes/' + el.getAttribute('data-cal'))));
  }

  function fld(label, id, val, extra) {
    return '<label class="f"><span>' + esc(label) + '</span><input class="in" id="' + id + '" value="'
      + esc(val === null || val === undefined ? '' : val) + '" ' + (extra || '') + '></label>';
  }

  function num(s) {
    const v = parseFloat(String(s).replace(',', '.'));
    return isNaN(v) ? null : v;
  }

  /* --- vínculos instrumento × aplicação --------------------------------------- */

  async function manageLinks(inst) {
    const data = await ctx();
    const ativos = Domain.linksOf(data.vinculos, inst.ID).map(v => String(v.Aplicacao));

    const body = h('div');
    body.innerHTML = data.aplicacoes.map(a =>
      '<label class="rule"><input type="checkbox" data-app="' + esc(a.ID) + '"'
      + (ativos.indexOf(String(a.ID)) >= 0 ? ' checked' : '') + '>' +
      '<span><b>' + esc(a.ID) + ' · EMA ' + fmtNum(a.EMA) + ' ' + esc(a.Unidade) + '</b>' +
      '<span>' + esc(a.Descricao) + '</span></span></label>').join('')
      || '<div class="empty">Cadastre aplicações primeiro.</div>';

    UI.modal({
      title: 'Vínculos de ' + inst.ID, body: body,
      actions: [
        { label: 'Fechar', onClick: c => c() },
        { label: 'Salvar vínculos', cls: 'solid', onClick: async (close, box) => {
          const marcadas = Array.from(box.querySelectorAll('[data-app]:checked')).map(x => x.getAttribute('data-app'));
          for (const a of data.aplicacoes) {
            const tem = data.vinculos.find(v => String(v.Instrumento) === String(inst.ID) && String(v.Aplicacao) === String(a.ID));
            const quer = marcadas.indexOf(String(a.ID)) >= 0;
            if (quer && !tem) {
              await DB.insert('vinculos', { ID: await DB.nextSeqId('V', 'vinculos'), Instrumento: inst.ID, Aplicacao: a.ID, Ativo: 1 });
            } else if (quer && tem && String(tem.Ativo) === '0') {
              await DB.update('vinculos', tem.ID, { Ativo: 1 });
            } else if (!quer && tem && String(tem.Ativo) !== '0') {
              await DB.update('vinculos', tem.ID, { Ativo: 0 });
            }
          }
          await DB.audit('Vínculos', 'Instrumento', inst.ID, 'Vínculos: ' + marcadas.join(', '));
          close();
          UI.toast('Vínculos salvos.');
          App.refresh();
        } }
      ]
    });
  }

  /* --- agendar / manutenção ------------------------------------------------------ */

  async function scheduleModal(inst) {
    const body = h('div');
    body.innerHTML =
      '<label class="f"><span>Data prevista</span><input class="in" type="date" id="agData" value="' + esc(Domain.addDaysISO(Domain.todayISO(), 30)) + '"></label>' +
      fld('Responsável', 'agResp', inst.Responsavel || '') +
      fld('Observação', 'agObs', '');

    UI.modal({
      title: 'Agendar calibração — ' + inst.ID, body: body,
      actions: [
        { label: 'Cancelar', onClick: c => c() },
        { label: 'Agendar', cls: 'solid', icon: 'calendar', onClick: async (close, box) => {
          const dataPrev = box.querySelector('#agData').value;
          if (!dataPrev) { UI.toast('Informe a data prevista.', 'err'); return; }
          await DB.insert('agenda', {
            ID: await DB.nextSeqId('AG', 'agenda'), Instrumento: inst.ID, DataPrevista: dataPrev,
            Responsavel: box.querySelector('#agResp').value.trim(), Status: 'Agendada',
            Obs: box.querySelector('#agObs').value.trim()
          });
          await DB.audit('Agendamento', 'Instrumento', inst.ID, 'Calibração agendada para ' + fmtDate(dataPrev));
          close(); UI.toast('Calibração agendada.');
        } }
      ]
    });
  }

  async function maintenanceModal(inst) {
    const body = h('div');
    body.innerHTML =
      '<label class="f"><span>Tipo</span><select class="in" id="mnTipo">' +
      ['Manutenção', 'Ajuste', 'Não conformidade', 'Ação corretiva'].map(t => '<option>' + t + '</option>').join('') +
      '</select></label>' +
      '<label class="f"><span>Descrição</span><textarea class="in" id="mnDesc"></textarea></label>';

    UI.modal({
      title: 'Registrar ocorrência — ' + inst.ID, body: body,
      actions: [
        { label: 'Cancelar', onClick: c => c() },
        { label: 'Registrar', cls: 'solid', onClick: async (close, box) => {
          const desc = box.querySelector('#mnDesc').value.trim();
          if (!desc) { UI.toast('Descreva a ocorrência.', 'err'); return; }
          await DB.insert('ocorrencias', {
            ID: await DB.nextSeqId('OC', 'ocorrencias'), Data: Domain.todayISO(), Instrumento: inst.ID,
            Tipo: box.querySelector('#mnTipo').value, Descricao: desc,
            Responsavel: await DB.currentUser(), Status: 'Aberta'
          });
          await DB.audit('Ocorrência', 'Instrumento', inst.ID, desc.slice(0, 120));
          close(); UI.toast('Ocorrência registrada.');
        } }
      ]
    });
  }

  /* =========================================================================
   * HISTÓRICO — carta de controle e deriva
   * ====================================================================== */

  async function historico(view, id) {
    const data = await ctx();
    const inst = data.instrumentos.find(i => String(i.ID) === String(id)) || data.instrumentos[0];
    if (!inst) { view.innerHTML = '<div class="empty">Sem instrumentos.</div>'; return; }

    const cals = Domain.calibrationsOf(data.calibracoes, inst.ID).filter(c => c.Status === 'Assinada');
    const links = Domain.linksOf(data.vinculos, inst.ID);
    const emas = links.map(v => {
      const app = data.aplicacoes.find(a => String(a.ID) === String(v.Aplicacao));
      return app ? { app: app, ema: Number(app.EMA) } : null;
    }).filter(Boolean);
    const emaCrit = emas.length ? Math.min.apply(null, emas.map(e => e.ema)) : null;

    // pontos disponíveis (nominais da última calibração)
    const ultima = cals[0];
    const nominais = ultima ? Domain.pointsOf(data.pontos, ultima.ID).map(p => Number(p.Nominal)) : [];
    let pontoSel = nominais.length ? nominais[nominais.length - 1] : null;

    view.innerHTML =
      '<div class="filters">' +
        '<select class="in" id="hInst">' + data.instrumentos.map(i =>
          '<option value="' + esc(i.ID) + '"' + (i.ID === inst.ID ? ' selected' : '') + '>'
          + esc(i.ID) + ' — ' + esc(i.Descricao) + '</option>').join('') + '</select>' +
        '<select class="in" id="hPonto">' + nominais.map(n =>
          '<option value="' + n + '"' + (n === pontoSel ? ' selected' : '') + '>'
          + 'Ponto: ' + fmtNum(n) + ' ' + esc(inst.Unidade || '') + '</option>').join('') + '</select>' +
        '<span class="chip mute">' + esc(inst.Grandeza || '') + ' (' + esc(inst.Unidade || '') + ')</span>' +
        '<div style="flex:1"></div><span id="hDerivaChip"></span>' +
      '</div>' +
      '<div class="cols cols-31">' +
        '<div class="card"><div class="card-hd"><h3>Erro no ponto de <span id="hPontoLbl"></span> ao longo das calibrações</h3></div>' +
          '<div id="hChart"></div>' +
          UI.legend([{ label: 'Erro', color: '#1668b4' }, { label: '+ EMA' + (emaCrit !== null ? ' (' + fmtNum(emaCrit, 3) + ' ' + (inst.Unidade || '') + ')' : ''), color: '#cf4040' }]) +
        '</div>' +
        '<div class="card"><div class="card-hd"><h3>' + icon('trend') + ' Análise de deriva</h3><span class="sub">ajuste do intervalo</span></div>' +
          '<div id="hDeriva"></div></div>' +
      '</div>' +
      '<div class="card"><div class="card-hd"><h3>Histórico de calibrações</h3>' +
        '<button class="link" id="btnPrint">' + icon('printer') + ' Exportar histórico (PDF)</button></div>' +
        '<table class="tbl"><thead><tr><th>Data</th><th>Certificado</th><th class="num">Erro máx. (' + esc(inst.Unidade || '') + ')</th>' +
        '<th class="num">U k=' + data.k + ' (' + esc(inst.Unidade || '') + ')</th><th>Intervalo</th><th>Resultado</th></tr></thead>' +
        '<tbody>' +
        (cals.length ? cals.map(c => {
          const pts = Domain.pointsOf(data.pontos, c.ID);
          const emax = pts.length ? Math.max.apply(null, pts.map(p => Math.abs(Number(p.Erro)))) : null;
          const umax = pts.length ? Math.max.apply(null, pts.map(p => Number(p.U))) : null;
          return '<tr data-cal="' + esc(c.ID) + '"><td>' + fmtDate(c.Data) + '</td>' +
            '<td class="mono">' + esc(c.ID) + '</td>' +
            '<td class="num">' + (emax !== null ? fmtSigned(emax, 3) : '—') + '</td>' +
            '<td class="num">' + (umax !== null ? fmtNum(umax, 3) : '—') + '</td>' +
            '<td>' + (inst.IntervaloMeses ? inst.IntervaloMeses + ' meses' : '—') + '</td>' +
            '<td>' + resultadoChip(c.Resultado) + '</td></tr>';
        }).join('') : '<tr><td colspan="6" class="empty">Sem calibrações assinadas.</td></tr>') +
        '</tbody></table></div>';

    function drawChart() {
      const dv = Domain.deriva(data, inst.ID, pontoSel);
      q(view, '#hPontoLbl').textContent = fmtNum(pontoSel) + ' ' + (inst.Unidade || '');
      q(view, '#hChart').innerHTML = dv.serie.length
        ? UI.chartLine({
            points: dv.serie.map(s => ({ label: fmtDate(s.data).slice(3), value: s.erro })),
            ema: emaCrit, unit: inst.Unidade })
        : '<div class="empty">Sem dados para este ponto.</div>';

      // análise de deriva
      const box = q(view, '#hDeriva');
      const chipBox = q(view, '#hDerivaChip');
      if (!dv.slopeAno || dv.serie.length < 3 || emaCrit === null) {
        box.innerHTML = '<div class="empty">Dados insuficientes para análise de deriva<br>(mínimo de 3 calibrações no ponto e uma aplicação vinculada).</div>';
        chipBox.innerHTML = '';
        return;
      }
      const porCal = dv.slopeAno * (Number(inst.IntervaloMeses) || 12) / 12;
      const anosRest = Domain.diffDays(inst.ProximaCal || Domain.todayISO(), Domain.todayISO()) / 365.25;
      const projetado = dv.ultimo + dv.slopeAno * Math.max(anosRest, 0);
      const cruza = dv.slopeAno > 0 && Math.abs(projetado) >= emaCrit;
      chipBox.innerHTML = cruza ? UI.chip('Deriva detectada') : UI.chip('Estável');

      let recomend;
      if (cruza) {
        // intervalo máximo para não cruzar o EMA: (ema - ultimo) / slope
        const anosAte = (emaCrit - dv.ultimo) / dv.slopeAno;
        const mesesSug = Math.max(1, Math.floor(anosAte * 12 * 0.9));
        recomend = 'Recomendação: reduzir o intervalo para ' + mesesSug + ' meses, evitando reprovação em uso e análise de impacto retroativa (ISO 9001 · 7.1.5).';
        box.innerHTML =
          '<dl class="klist">' +
          '<dt>Tendência</dt><dd>' + fmtSigned(porCal, 4) + ' ' + esc(inst.Unidade || '') + ' por calibração</dd>' +
          '<dt>Projeção</dt><dd>' + (Math.abs(projetado) >= emaCrit ? 'atinge o EMA na próxima calibração' : 'dentro do EMA na próxima calibração') + '</dd>' +
          '<dt>Intervalo atual</dt><dd>' + (inst.IntervaloMeses || 12) + ' meses</dd>' +
          '</dl>' +
          '<div class="notebox">' + esc(recomend) + '</div>' +
          '<button class="btn solid block" id="btnIntervalo">' + icon('calendar') + ' Aplicar novo intervalo (' + mesesSug + ' meses)</button>';
        q(view, '#btnIntervalo').addEventListener('click', async () => {
          const proxima = Domain.addDaysISO(inst.UltimaCal || Domain.todayISO(), mesesSug * 30);
          await DB.update('instrumentos', inst.ID, { IntervaloMeses: mesesSug, ProximaCal: proxima });
          await DB.audit('Intervalo', 'Instrumento', inst.ID, 'Intervalo ajustado para ' + mesesSug + ' meses (análise de deriva).');
          UI.toast('Intervalo ajustado para ' + mesesSug + ' meses.');
          historico(view, inst.ID);
        });
      } else {
        box.innerHTML =
          '<dl class="klist">' +
          '<dt>Tendência</dt><dd>' + fmtSigned(porCal, 4) + ' ' + esc(inst.Unidade || '') + ' por calibração</dd>' +
          '<dt>Projeção</dt><dd>permanece dentro do EMA na próxima calibração</dd>' +
          '<dt>Intervalo atual</dt><dd>' + (inst.IntervaloMeses || 12) + ' meses</dd>' +
          '</dl>' +
          '<div class="notebox">Sem deriva significativa neste ponto. O intervalo atual está adequado.</div>';
      }
    }

    q(view, '#hInst').addEventListener('change', e => App.go('instrumentos/' + e.target.value + '/historico'));
    q(view, '#hPonto').addEventListener('change', e => { pontoSel = Number(e.target.value); drawChart(); });
    q(view, '#btnPrint').addEventListener('click', () => window.print());
    qa(view, 'tr[data-cal]').forEach(tr => tr.addEventListener('click', () => App.go('calibracoes/' + tr.getAttribute('data-cal'))));

    drawChart();
  }

  /* =========================================================================
   * PADRÕES — lista e detalhe (hierarquia + impacto)
   * ====================================================================== */

  async function padroes(view) {
    const data = await ctx();
    const hoje = Domain.todayISO();

    view.innerHTML =
      '<div class="filters"><div style="flex:1"></div>' +
      '<button class="btn solid" id="btnNew">' + icon('plus') + ' Novo padrão</button></div>' +
      '<div class="card" style="padding:6px 0 2px">' +
      '<table class="tbl"><thead><tr><th>ID</th><th>Descrição</th><th>Tipo</th><th>Grandeza</th>' +
      '<th>Certificado</th><th>Validade</th><th class="num">Incerteza</th><th>Status</th></tr></thead><tbody>' +
      data.padroes.map(p => {
        const venc = p.Validade && Domain.diffDays(p.Validade, hoje) < 0;
        return '<tr data-id="' + esc(p.ID) + '">' +
          '<td class="rowid">' + esc(p.ID) + '</td><td>' + esc(p.Descricao) + '</td>' +
          '<td>' + UI.chip(p.Tipo) + '</td><td>' + esc(p.Grandeza) + '</td>' +
          '<td class="mono">' + esc(p.Certificado || '—') + '</td>' +
          '<td class="' + (venc ? 'bad' : '') + '">' + fmtDate(p.Validade) + '</td>' +
          '<td class="num">' + fmtNum(p.Incerteza, 4) + ' ' + esc(p.Unidade || '') + '</td>' +
          '<td>' + UI.chip(p.Status) + '</td></tr>';
      }).join('') +
      '</tbody></table></div>';

    q(view, '#btnNew').addEventListener('click', () => padraoModal(null));
    qa(view, 'tr[data-id]').forEach(tr => tr.addEventListener('click', () => App.go('padroes/' + tr.getAttribute('data-id'))));
  }

  async function padraoModal(id) {
    const data = await ctx();
    const p = id ? data.padroes.find(x => String(x.ID) === String(id)) : {
      ID: await DB.nextSeqId('PD', 'padroes'), Tipo: 'Trabalho', Grandeza: 'Dimensional', Unidade: 'mm', Status: 'Ativo'
    };
    const body = h('div');
    body.innerHTML = '<div class="fgrid c2">' +
      fld('Identificação', 'pID', p.ID, id ? 'disabled' : '') +
      fld('Descrição', 'pDesc', p.Descricao) +
      '<label class="f"><span>Tipo</span><select class="in" id="pTipo">' +
        ['Trabalho', 'Referência', 'Primário'].map(t => '<option' + (t === p.Tipo ? ' selected' : '') + '>' + t + '</option>').join('') + '</select></label>' +
      fld('Grandeza', 'pGr', p.Grandeza) +
      fld('Unidade', 'pUn', p.Unidade) +
      fld('Faixa', 'pFaixa', p.Faixa) +
      fld('Certificado nº', 'pCert', p.Certificado) +
      fld('Laboratório', 'pLab', p.Laboratorio) +
      '<label class="f"><span>Data da calibração</span><input class="in" type="date" id="pData" value="' + esc(p.DataCal || '') + '"></label>' +
      '<label class="f"><span>Validade</span><input class="in" type="date" id="pVal" value="' + esc(p.Validade || '') + '"></label>' +
      fld('Incerteza (U)', 'pU', p.Incerteza) +
      '<label class="f"><span>Padrão superior (rastreio)</span><select class="in" id="pSup"><option value="">— calibrado por laboratório externo —</option>' +
        data.padroes.filter(x => !id || String(x.ID) !== String(id)).map(x =>
          '<option' + (String(x.ID) === String(p.PadraoSuperior) ? ' selected' : '') + '>' + esc(x.ID) + '</option>').join('') + '</select></label>' +
      '</div>';

    UI.modal({
      title: id ? 'Editar padrão ' + id : 'Novo padrão', body: body, wide: true,
      actions: [
        { label: 'Cancelar', onClick: c => c() },
        { label: 'Salvar', cls: 'solid', onClick: async (close, box) => {
          const g = s => box.querySelector(s).value;
          const patch = {
            Descricao: g('#pDesc').trim(), Tipo: g('#pTipo'), Grandeza: g('#pGr').trim(),
            Unidade: g('#pUn').trim(), Faixa: g('#pFaixa').trim(), Certificado: g('#pCert').trim(),
            Laboratorio: g('#pLab').trim(), DataCal: g('#pData') || null, Validade: g('#pVal') || null,
            Incerteza: num(g('#pU')), PadraoSuperior: g('#pSup') || null
          };
          if (!patch.Descricao) { UI.toast('Informe a descrição.', 'err'); return; }
          if (id) {
            await DB.update('padroes', id, patch);
            await DB.audit('Edição', 'Padrao', id, 'Padrão atualizado.');
          } else {
            patch.ID = g('#pID').trim();
            patch.Status = 'Ativo';
            await DB.insert('padroes', patch);
            await DB.audit('Cadastro', 'Padrao', patch.ID, 'Padrão cadastrado: ' + patch.Descricao);
          }
          close(); UI.toast('Padrão salvo.'); App.refresh();
        } }
      ]
    });
  }

  async function padrao(view, id) {
    const data = await ctx();
    const p = data.padroes.find(x => String(x.ID) === String(id));
    if (!p) { view.innerHTML = '<div class="empty">Padrão não encontrado.</div>'; return; }

    const sup = p.PadraoSuperior ? data.padroes.find(x => String(x.ID) === String(p.PadraoSuperior)) : null;
    const imp = Domain.impactoPadrao(data, p.ID);
    const venc = p.Validade && Domain.diffDays(p.Validade, Domain.todayISO()) < 0;

    view.innerHTML =
      '<div class="cols cols-21">' +
        '<div class="card"><div class="card-hd"><h3>' + esc(p.ID) + ' — ' + esc(p.Descricao) + '</h3>' + UI.chip(p.Status) + '</div>' +
          '<dl class="klist">' +
            '<dt>Tipo</dt><dd>' + UI.chip(p.Tipo) + '</dd>' +
            '<dt>Grandeza</dt><dd>' + esc(p.Grandeza) + ' (' + esc(p.Unidade) + ')</dd>' +
            '<dt>Faixa</dt><dd>' + esc(p.Faixa || '—') + '</dd>' +
            '<dt>Certificado</dt><dd>' + esc(p.Certificado || '—') + '</dd>' +
            '<dt>Laboratório</dt><dd>' + esc(p.Laboratorio || '—') + '</dd>' +
            '<dt>Data da calibração</dt><dd>' + fmtDate(p.DataCal) + '</dd>' +
            '<dt>Validade</dt><dd' + (venc ? ' class="bad"' : '') + '>' + fmtDate(p.Validade) + (venc ? ' — vencido' : '') + '</dd>' +
            '<dt>Incerteza (U, k=' + data.k + ')</dt><dd>' + fmtNum(p.Incerteza, 4) + ' ' + esc(p.Unidade) + '</dd>' +
          '</dl>' +
          (p.Obs ? '<div class="notebox">' + esc(p.Obs) + '</div>' : '') +
          '<div class="row">' +
            '<button class="btn" id="btnEdit">' + icon('edit') + ' Editar</button>' +
            (p.Status === 'Reprovado'
              ? '<button class="btn" id="btnAprovar">' + icon('check') + ' Marcar como ativo</button>'
              : '<button class="btn danger" id="btnReprovar">' + icon('ban') + ' Reprovar padrão</button>') +
          '</div>' +
        '</div>' +

        '<div class="card"><div class="card-hd"><h3>Cadeia de rastreabilidade</h3></div>' +
          '<div class="chain">' +
            cnode('Este padrão', p.ID) +
            '<span class="carrow">' + icon('arrowR') + '</span>' +
            (sup ? cnode('Padrão superior', sup.ID + ' · cert. ' + (sup.Certificado || '—'))
                 : cnode('Laboratório', p.Laboratorio || '—')) +
            '<span class="carrow">' + icon('arrowR') + '</span>' +
            (sup ? cnode('Lab. acreditado', sup.Laboratorio || '—') : cnode('SI', 'Unidades do SI')) +
            (sup ? '<span class="carrow">' + icon('arrowR') + '</span>' + cnode('SI', 'Unidades do SI') : '') +
          '</div>' +
          '<div class="card-hd mt"><h3>Impacto — calibrado com este padrão</h3><span class="sub">'
            + imp.instrumentos.length + ' instrumento(s) · ' + imp.calibracoes.length + ' calibração(ões)</span></div>' +
          (imp.calibracoes.length
            ? '<table class="tbl"><thead><tr><th>Calibração</th><th>Data</th><th>Instrumento</th><th>Resultado</th></tr></thead><tbody>'
              + imp.calibracoes.map(c =>
                '<tr data-cal="' + esc(c.ID) + '"><td class="mono">' + esc(c.ID) + '</td><td>' + fmtDate(c.Data) + '</td>' +
                '<td class="b">' + esc(c.Instrumento) + '</td><td>' + resultadoChip(c.Resultado) + '</td></tr>').join('')
              + '</tbody></table>'
            : '<div class="empty">Nenhuma calibração usou este padrão.</div>') +
          (p.Status === 'Reprovado' && imp.instrumentos.length
            ? '<div class="notebox" style="background:var(--red-soft);color:#8f3535">Padrão reprovado: as ' + imp.calibracoes.length
              + ' calibração(ões) acima estão sob suspeita. Avalie os instrumentos ' + esc(imp.instrumentos.join(', '))
              + ' e registre a análise de impacto (ISO 9001 · 7.1.5).</div>'
            : '') +
        '</div>' +
      '</div>';

    q(view, '#btnEdit').addEventListener('click', () => padraoModal(p.ID));
    const btnR = q(view, '#btnReprovar'), btnA = q(view, '#btnAprovar');
    if (btnR) btnR.addEventListener('click', async () => {
      if (!(await UI.confirmBox('Reprovar o padrão ' + p.ID + '? O impacto ficará visível no dashboard.', 'Reprovar'))) return;
      await DB.update('padroes', p.ID, { Status: 'Reprovado' });
      await DB.audit('Reprovação', 'Padrao', p.ID, 'Padrão reprovado.');
      UI.toast('Padrão reprovado.'); padrao(view, p.ID);
    });
    if (btnA) btnA.addEventListener('click', async () => {
      await DB.update('padroes', p.ID, { Status: 'Ativo' });
      await DB.audit('Liberação', 'Padrao', p.ID, 'Padrão novamente ativo.');
      UI.toast('Padrão ativo.'); padrao(view, p.ID);
    });
    qa(view, 'tr[data-cal]').forEach(tr => tr.addEventListener('click', () => App.go('calibracoes/' + tr.getAttribute('data-cal'))));
  }

  function cnode(small, big) {
    return '<div class="cnode"><span class="cic">' + icon('award') + '</span><div style="min-width:0"><small>'
      + esc(small) + '</small><b title="' + esc(big) + '">' + esc(big) + '</b></div></div>';
  }

  /* =========================================================================
   * CALIBRAÇÕES — lista
   * ====================================================================== */

  async function calibracoes(view) {
    const data = await ctx();
    const cals = data.calibracoes.slice().sort((a, b) => String(b.Data).localeCompare(String(a.Data)));
    const instPorId = {};
    data.instrumentos.forEach(i => instPorId[i.ID] = i);

    view.innerHTML =
      '<div class="card" style="padding:6px 0 2px">' +
      '<table class="tbl"><thead><tr><th>Calibração</th><th>Instrumento</th><th>Data</th>' +
      '<th>Metrologista</th><th>Tipo</th><th>Resultado</th><th>Status</th></tr></thead><tbody>' +
      (cals.length ? cals.map(c => {
        const inst = instPorId[c.Instrumento];
        return '<tr data-id="' + esc(c.ID) + '">' +
          '<td class="mono b">' + esc(c.ID) + '</td>' +
          '<td>' + esc(c.Instrumento) + (inst ? ' · ' + esc(inst.Descricao) : '') + '</td>' +
          '<td>' + fmtDate(c.Data) + '</td><td>' + esc(c.Metrologista || '—') + '</td>' +
          '<td>' + esc(c.Tipo || '—') + '</td>' +
          '<td>' + resultadoChip(c.Resultado) + '</td>' +
          '<td>' + UI.chip(c.Status || 'Rascunho') + '</td></tr>';
      }).join('') : '<tr><td colspan="7" class="empty">Nenhuma calibração registrada.</td></tr>') +
      '</tbody></table></div>';

    qa(view, 'tr[data-id]').forEach(tr => tr.addEventListener('click', () => App.go('calibracoes/' + tr.getAttribute('data-id'))));
  }

  /* =========================================================================
   * CALIBRAÇÃO — registro / visualização
   * ====================================================================== */

  async function calibracao(view, id, params) {
    const isNew = id === 'nova';
    const data = await ctx();
    let cal, inst;

    if (isNew) {
      inst = data.instrumentos.find(i => String(i.ID) === String(params));
      if (!inst) { view.innerHTML = '<div class="empty">Instrumento não encontrado.</div>'; return; }
      cal = {
        ID: null, Instrumento: inst.ID, Data: Domain.todayISO(), Metrologista: data.usuario,
        Procedimento: '', Temperatura: 20, Umidade: 50, Tipo: 'Interna', Resultado: null,
        Regra: data.regraPadrao, Status: 'Rascunho'
      };
    } else {
      cal = data.calibracoes.find(c => String(c.ID) === String(id));
      if (!cal) { view.innerHTML = '<div class="empty">Calibração não encontrada.</div>'; return; }
      inst = data.instrumentos.find(i => String(i.ID) === String(cal.Instrumento));
    }

    const readonly = cal.Status === 'Assinada';
    const links = Domain.linksOf(data.vinculos, inst.ID);
    const appsVinc = links.map(v => data.aplicacoes.find(a => String(a.ID) === String(v.Aplicacao))).filter(Boolean);
    const appCrit = appsVinc.length ? appsVinc.reduce((a, b) => Number(a.EMA) <= Number(b.EMA) ? a : b) : null;

    // padrões da mesma grandeza para o seletor da cadeia
    const padroesAptos = data.padroes.filter(p => p.Grandeza === inst.Grandeza);
    let padroesUsados = isNew ? [] : Domain.standardsOf(data.calpadroes, cal.ID);
    if (isNew && padroesAptos.length) padroesUsados = [padroesAptos[0].ID];

    // pontos: existentes ou gabarito 0/25/50/75/100% da faixa
    let pontos = isNew ? [] : Domain.pointsOf(data.pontos, cal.ID);
    if (isNew) {
      const min = Number(inst.FaixaMin) || 0, max = Number(inst.FaixaMax) || 0;
      const fator = [0, 0.25, 0.5, 0.75, 1];
      const rotulo = ['0%', '25%', '50%', '75%', '100%'];
      pontos = fator.map((f, i) => {
        const nominal = Math.round((min + (max - min) * f) * 10000) / 10000;
        return { Ordem: i + 1, Ponto: rotulo[i], Nominal: nominal, Padrao: nominal, R1: null, R2: null, R3: null, Media: null, Erro: null, U: null, K: data.k };
      });
    }

    /* --- render ------------------------------------------------------------ */

    function render() {
      const foto = '<span class="thumb-ph">' + icon('camera') + '</span>';
      const regra = cal.Regra || data.regraPadrao;

      view.innerHTML =
        '<div class="card"><div class="cal-head">' +
          '<span id="calFoto">' + foto + '</span>' +
          '<div class="ci" style="min-width:220px"><b>' + esc(inst.ID) + ' — ' + esc(inst.Descricao) + '</b>' +
            '<small>' + esc((inst.Fabricante || '') + ' ' + (inst.Modelo || '')) + (inst.NumSerie ? ' · S/N ' + esc(inst.NumSerie) : '') + '</small></div>' +
          '<div class="ci"><small>Procedimento</small>' + (readonly
            ? '<b>' + esc(cal.Procedimento || '—') + '</b>'
            : '<input class="in" id="cProc" style="width:170px" value="' + esc(cal.Procedimento || '') + '">') + '</div>' +
          '<div class="ci"><small>Data</small>' + (readonly
            ? '<b>' + fmtDate(cal.Data) + '</b>'
            : '<input class="in" type="date" id="cData" style="width:150px" value="' + esc(cal.Data) + '">') + '</div>' +
          '<div class="ci"><small>Metrologista</small>' + (readonly
            ? '<b>' + esc(cal.Metrologista || '—') + '</b>'
            : '<input class="in" id="cMetro" style="width:150px" value="' + esc(cal.Metrologista || '') + '">') + '</div>' +
          '<div class="ci"><small>Tipo</small>' + (readonly
            ? '<b>' + esc(cal.Tipo) + '</b>'
            : '<select class="in" id="cTipo"><option' + (cal.Tipo === 'Interna' ? ' selected' : '') + '>Interna</option><option' + (cal.Tipo === 'Externa' ? ' selected' : '') + '>Externa</option></select>') + '</div>' +
          '<div style="flex:1"></div>' +
          (readonly
            ? '<span class="envchip">' + icon('thermo') + ' ' + fmtNum(cal.Temperatura, 1) + ' °C</span>' +
              '<span class="envchip">' + icon('drop') + ' ' + fmtNum(cal.Umidade, 0) + ' %UR</span>'
            : '<span class="envchip">' + icon('thermo') + '<input id="cTemp" value="' + esc(cal.Temperatura) + '"> °C</span>' +
              '<span class="envchip">' + icon('drop') + '<input id="cUmid" value="' + esc(cal.Umidade) + '"> %UR</span>') +
        '</div></div>' +

        /* cadeia de rastreabilidade */
        '<div class="card"><div class="card-hd"><h3>Cadeia de rastreabilidade</h3></div>' +
          '<div class="chain" id="chain"></div>' +
        '</div>' +

        /* pontos */
        '<div class="card"><div class="card-hd"><h3>Pontos de calibração' + (readonly ? '' : ' — média de 3 repetições') + '</h3>' +
          '<span class="sub">' + (appCrit
            ? 'EMA exibido: aplicação crítica ' + esc(appCrit.ID) + ' (' + fmtNum(appCrit.EMA, 3) + ' ' + esc(appCrit.Unidade) + ') · avaliação ponto a ponto'
            : 'Sem aplicação vinculada — sem avaliação de conformidade') + '</span></div>' +
          '<table class="tbl"><thead><tr><th>Ponto</th><th class="num">Nominal (' + esc(inst.Unidade) + ')</th>' +
          '<th class="num">Padrão</th>' + (readonly ? '' : '<th class="num">R1</th><th class="num">R2</th><th class="num">R3</th>') +
          '<th class="num">Lido — média</th><th class="num">Erro</th><th class="num">U k=' + data.k + '</th>' +
          (appCrit ? '<th class="num">EMA ' + esc(appCrit.ID) + '</th><th>Avaliação</th>' : '') +
          '</tr></thead><tbody id="ptsBody"></tbody></table>' +
          (readonly ? '' : '<button class="btn ghost sm mt" id="btnAddPonto">' + icon('plus') + ' Adicionar ponto</button>') +
        '</div>' +

        '<div class="cols cols-2">' +
          '<div class="card"><div class="card-hd"><h3>Regra de decisão (ILAC G8)</h3></div><div id="rules">' +
            ruleHtml('simples', 'Aceitação simples', '|erro| ≤ EMA — sem considerar a incerteza', regra, readonly) +
            ruleHtml('guarda', 'Banda de guarda', '|erro| ≤ EMA − U · U expandida, k = ' + data.k, regra, readonly) +
            ruleHtml('tur', 'Razão TUR ≥ 4:1', '<span id="turLine">TUR calculado —</span>', regra, readonly) +
          '</div>' +
          '<div class="rule-note">A banda de guarda reduz o limite de aceitação do EMA conforme a incerteza de cada ponto.</div></div>' +

          '<div class="card"><div class="card-hd"><h3>Resultado da calibração</h3></div>' +
            '<div id="resultBox"></div>' +
            '<div id="resultTxt" style="font-size:12px;color:var(--soft)"></div>' +
            '<div class="mt" style="font-size:11px;color:var(--faint)">' +
              (readonly
                ? 'Assinada por ' + esc(cal.AssinadoPor || '—') + ' em ' + fmtDateTime(cal.DataAssinatura) + ' · trilha de auditoria ativa (ISO 17025 / IATF 16949)'
                : 'Assinatura eletrônica pendente · trilha de auditoria ativa (ISO 17025 / IATF 16949)') +
            '</div>' +
            '<div class="row mt">' +
              (readonly
                ? '<button class="btn" id="btnCert">' + icon('printer') + ' Certificado</button>' +
                  (cal.CertificadoRef
                    ? '<button class="btn" id="btnPdf">' + icon('file') + ' PDF anexado</button>'
                    : '') +
                  '<button class="btn" id="btnAnexar">' + icon('upload') + ' Anexar PDF externo</button>'
                : '<button class="btn" id="btnRascunho">Salvar rascunho</button>' +
                  '<button class="btn" id="btnCert">' + icon('printer') + ' Gerar certificado</button>' +
                  '<button class="btn solid" id="btnAssinar">' + icon('edit') + ' Assinar e aprovar</button>') +
            '</div>' +
          '</div>' +
        '</div>';

      drawChain();
      drawPontos();
      drawResultado();
      wire();
    }

    function ruleHtml(value, titulo, sub, atual, ro) {
      return '<label class="rule' + (atual === value ? ' on' : '') + '">' +
        '<input type="radio" name="regra" value="' + value + '"' + (atual === value ? ' checked' : '') + (ro ? ' disabled' : '') + '>' +
        '<span><b>' + titulo + '</b><span>' + sub + '</span></span></label>';
    }

    function drawChain() {
      const box = q(view, '#chain');
      const trabalho = data.padroes.find(p => padroesUsados[0] === p.ID);
      const superior = trabalho && trabalho.PadraoSuperior
        ? data.padroes.find(p => String(p.ID) === String(trabalho.PadraoSuperior)) : null;
      const lab = (superior && superior.Laboratorio) || (trabalho && trabalho.Laboratorio) || '—';

      let html = cnode('Instrumento', inst.ID);
      html += '<span class="carrow">' + icon('arrowR') + '</span>';
      if (readonly) {
        html += cnode('Padrão de trabalho', trabalho ? trabalho.ID : '—');
      } else {
        html += '<div class="cnode"><span class="cic">' + icon('award') + '</span><div style="min-width:0;flex:1">' +
          '<small>Padrão de trabalho</small>' +
          '<select class="in" id="cPadrao">' +
          (padroesAptos.length ? padroesAptos.map(p =>
            '<option value="' + esc(p.ID) + '"' + (padroesUsados[0] === p.ID ? ' selected' : '') + '>'
            + esc(p.ID) + ' — ' + esc(p.Descricao) + '</option>').join('')
            : '<option value="">— nenhum padrão da grandeza ' + esc(inst.Grandeza) + ' —</option>') +
          '</select></div></div>';
      }
      html += '<span class="carrow">' + icon('arrowR') + '</span>';
      html += cnode('Padrão de referência', superior ? superior.ID + ' · cert. ' + (superior.Certificado || '—') : (trabalho ? 'via ' + (trabalho.Laboratorio || 'lab.') : '—'));
      html += '<span class="carrow">' + icon('arrowR') + '</span>';
      html += cnode('Lab. acreditado', lab);
      html += '<span class="carrow">' + icon('arrowR') + '</span>';
      html += cnode('SI', 'Unidades do SI');
      box.innerHTML = html;

      const sel = q(view, '#cPadrao');
      if (sel) sel.addEventListener('change', () => { padroesUsados = sel.value ? [sel.value] : []; drawChain(); });
    }

    function drawPontos() {
      const body = q(view, '#ptsBody');
      const ema = appCrit ? Number(appCrit.EMA) : null;
      const regra = cal.Regra || data.regraPadrao;

      body.innerHTML = pontos.map((p, i) => {
        const completo = p.Media !== null && p.Media !== undefined;
        const erro = completo ? Number(p.Erro) : null;
        const aval = (ema !== null && completo && p.U !== null) ? Domain.evaluate(erro, p.U, ema, regra) : null;
        return '<tr>' +
          '<td>' + (readonly ? esc(p.Ponto || (i + 1)) : '<input class="in" data-f="Ponto" data-i="' + i + '" style="width:64px" value="' + esc(p.Ponto || '') + '">') + '</td>' +
          '<td class="num">' + (readonly ? fmtNum(p.Nominal, 3) : '<input class="in" data-f="Nominal" data-i="' + i + '" style="width:84px;text-align:right" value="' + esc(p.Nominal) + '">') + '</td>' +
          '<td class="num">' + (readonly ? fmtNum(p.Padrao, 3) : '<input class="in" data-f="Padrao" data-i="' + i + '" style="width:84px;text-align:right" value="' + esc(p.Padrao) + '">') + '</td>' +
          (readonly ? '' :
            '<td class="num"><input class="in" data-f="R1" data-i="' + i + '" style="width:74px;text-align:right" value="' + esc(p.R1 === null ? '' : p.R1) + '"></td>' +
            '<td class="num"><input class="in" data-f="R2" data-i="' + i + '" style="width:74px;text-align:right" value="' + esc(p.R2 === null ? '' : p.R2) + '"></td>' +
            '<td class="num"><input class="in" data-f="R3" data-i="' + i + '" style="width:74px;text-align:right" value="' + esc(p.R3 === null ? '' : p.R3) + '"></td>') +
          '<td class="num b">' + (completo ? fmtNum(p.Media, 3) : '—') + '</td>' +
          '<td class="num b">' + (completo ? fmtSigned(p.Erro, 3) : '—') + '</td>' +
          '<td class="num">' + (readonly ? fmtNum(p.U, 3) : '<input class="in" data-f="U" data-i="' + i + '" style="width:70px;text-align:right" value="' + esc(p.U === null ? '' : p.U) + '">') + '</td>' +
          (appCrit
            ? '<td class="num">' + fmtNum(ema, 3) + '</td>' +
              '<td>' + (aval ? UI.chip(aval.ok ? 'Atende' : 'Não atende') : '<span class="muted">—</span>') + '</td>'
            : '') +
        '</tr>';
      }).join('');

      if (!readonly) {
        qa(view, 'input[data-f]').forEach(inp => inp.addEventListener('change', () => {
          const i = Number(inp.getAttribute('data-i')), f = inp.getAttribute('data-f');
          const v = inp.value.trim();
          if (f === 'Ponto') pontos[i][f] = v;
          else pontos[i][f] = v === '' ? null : num(v);
          // recalcula média e erro
          const p = pontos[i];
          const reps = [p.R1, p.R2, p.R3].filter(x => x !== null && !isNaN(Number(x)));
          if (reps.length) {
            p.Media = Math.round(reps.reduce((a, b) => a + Number(b), 0) / reps.length * 10000) / 10000;
            p.Erro = Math.round((p.Media - Number(p.Padrao)) * 10000) / 10000;
          } else { p.Media = null; p.Erro = null; }
          drawPontos();
          drawResultado();
        }));
      }
    }

    function resultadoAtual() {
      if (!appsVinc.length) return { resultado: null, linhas: [] };
      const regra = cal.Regra || data.regraPadrao;
      let okN = 0, noN = 0;
      const linhas = appsVinc.map(app => {
        const ema = Number(app.EMA);
        const ptsFaixa = pontos.filter(p => {
          const n = Number(p.Nominal);
          const min = app.FaixaMin !== null && app.FaixaMin !== '' ? Number(app.FaixaMin) : -Infinity;
          const max = app.FaixaMax !== null && app.FaixaMax !== '' ? Number(app.FaixaMax) : Infinity;
          return n >= min && n <= max;
        });
        const falhos = ptsFaixa.filter(p => p.Erro !== null && p.U !== null && !Domain.evaluate(p.Erro, p.U, ema, regra).ok);
        const atende = ptsFaixa.length > 0 && falhos.length === 0 && ptsFaixa.every(p => p.Erro !== null);
        if (atende) okN++; else noN++;
        return { app: app, atende: atende, falhos: falhos };
      });
      const completo = pontos.length > 0 && pontos.every(p => p.Erro !== null && p.U !== null);
      const resultado = !completo ? null
        : noN === 0 ? 'Aprovado' : okN === 0 ? 'Reprovado' : 'Aprovado c/ restrição';
      return { resultado: resultado, linhas: linhas, completo: completo };
    }

    function drawResultado() {
      const r = resultadoAtual();
      const box = q(view, '#resultBox'), txt = q(view, '#resultTxt');

      // TUR da aplicação crítica com os pontos preenchidos
      if (appCrit) {
        const ema = Number(appCrit.EMA);
        const usados = pontos.filter(p => p.U !== null && Number(p.U) > 0);
        const tur = usados.length ? ema / Math.max.apply(null, usados.map(p => Number(p.U))) : null;
        const turLine = q(view, '#turLine');
        if (turLine) {
          turLine.innerHTML = tur === null ? 'TUR calculado —'
            : 'TUR calculado ' + fmtNum(tur, 1) + ':1' + (tur < 4 ? ' — <span class="warnline">insuficiente para esta regra</span>' : '');
        }
      }

      if (!r.resultado) {
        box.innerHTML = '<div class="resultbox" style="background:var(--gray-soft);color:var(--soft)">'
          + (appsVinc.length ? 'Preencha todos os pontos para concluir' : 'Sem aplicações vinculadas — resultado livre') + '</div>';
        txt.textContent = '';
        return;
      }
      const cls = r.resultado === 'Aprovado' ? 'ok' : r.resultado === 'Reprovado' ? 'err' : 'warn';
      box.innerHTML = '<div class="resultbox ' + cls + '">' + esc(r.resultado) + '</div>';
      txt.innerHTML = r.linhas.map(l =>
        (l.atende ? 'Atende' : 'Não atende') + ' à aplicação <b>' + esc(l.app.ID) + '</b> (EMA '
        + fmtNum(l.app.EMA, 3) + ' ' + esc(l.app.Unidade) + ')'
        + (l.atende ? ' em toda a faixa de uso.' : ' nos pontos: ' + l.falhos.map(p => esc(p.Ponto || fmtNum(p.Nominal))).join(', ') + '.')
      ).join('<br>');
    }

    function wire() {
      if (!readonly) {
        q(view, '#btnAddPonto').addEventListener('click', () => {
          pontos.push({ Ordem: pontos.length + 1, Ponto: '', Nominal: 0, Padrao: 0, R1: null, R2: null, R3: null, Media: null, Erro: null, U: null, K: data.k });
          drawPontos();
        });
        qa(view, 'input[name=regra]').forEach(rd => rd.addEventListener('change', () => {
          cal.Regra = rd.value;
          render();
        }));
        q(view, '#btnRascunho').addEventListener('click', () => salvar(false));
        q(view, '#btnAssinar').addEventListener('click', () => salvar(true));
        q(view, '#btnCert').addEventListener('click', () => certificado(cal, inst, pontos, appCrit));
      } else {
        q(view, '#btnCert').addEventListener('click', () => certificado(cal, inst, pontos, appCrit));
        const bp = q(view, '#btnPdf');
        if (bp) bp.addEventListener('click', () => Files.open(cal.CertificadoRef));
        q(view, '#btnAnexar').addEventListener('click', async () => {
          const f = await UI.pickFile('.pdf', false);
          if (!f) return;
          const ref = await Files.save(cal.ID + '.pdf', f.base64);
          await DB.update('calibracoes', cal.ID, { CertificadoRef: ref });
          await DB.audit('Certificado', 'Calibracao', cal.ID, 'PDF externo anexado.');
          UI.toast('PDF anexado.');
          App.refresh();
        });
      }
    }

    async function salvar(assinar) {
      const r = resultadoAtual();
      if (assinar && appsVinc.length && !r.completo) {
        UI.toast('Preencha todos os pontos antes de assinar.', 'err'); return;
      }

      const cab = {
        Data: q(view, '#cData').value || Domain.todayISO(),
        Metrologista: q(view, '#cMetro').value.trim(),
        Procedimento: q(view, '#cProc').value.trim(),
        Temperatura: num(q(view, '#cTemp').value),
        Umidade: num(q(view, '#cUmid').value),
        Tipo: q(view, '#cTipo').value,
        Regra: cal.Regra || data.regraPadrao
      };

      if (isNew) {
        cal.ID = await DB.nextCalId(cab.Data);
        await DB.insert('calibracoes', Object.assign({}, cal, cab, {
          Resultado: r.resultado, Status: 'Rascunho'
        }));
      } else {
        await DB.update('calibracoes', cal.ID, Object.assign(cab, { Resultado: r.resultado || cal.Resultado }));
      }

      // pontos: regrava os da calibração (apaga os antigos escrevendo por cima;
      // se houver mais antigos que novos, o excedente é limpo)
      const antigos = data.pontos.filter(p => String(p.Calibracao) === String(cal.ID));
      for (let i = 0; i < pontos.length; i++) {
        const row = Object.assign({ Calibracao: cal.ID, Ordem: i + 1, K: data.k }, pontos[i]);
        if (i < antigos.length) {
          await DB.writeRowAt('pontos', antigos[i].__row,
            DB.SHEETS.pontos.cols.map(c => row[c] === undefined ? null : row[c]));
        } else {
          await DB.appendRow('pontos', DB.SHEETS.pontos.cols.map(c => row[c] === undefined ? null : row[c]));
        }
      }
      for (let i = pontos.length; i < antigos.length; i++) {
        await DB.writeRowAt('pontos', antigos[i].__row, DB.SHEETS.pontos.cols.map(() => null));
      }

      // padrões usados
      if (isNew || true) {
        const antigosCP = data.calpadroes.filter(p => String(p.Calibracao) === String(cal.ID));
        for (let i = 0; i < padroesUsados.length; i++) {
          if (i < antigosCP.length) await DB.writeRowAt('calpadroes', antigosCP[i].__row, [cal.ID, padroesUsados[i]]);
          else await DB.appendRow('calpadroes', [cal.ID, padroesUsados[i]]);
        }
        for (let i = padroesUsados.length; i < antigosCP.length; i++) {
          await DB.writeRowAt('calpadroes', antigosCP[i].__row, [null, null]);
        }
      }

      if (assinar) {
        const usuario = await DB.currentUser();
        const agora = new Date();
        const stamp = agora.getFullYear() + '-' + String(agora.getMonth() + 1).padStart(2, '0') + '-'
          + String(agora.getDate()).padStart(2, '0') + 'T' + String(agora.getHours()).padStart(2, '0')
          + ':' + String(agora.getMinutes()).padStart(2, '0');
        await DB.update('calibracoes', cal.ID, {
          Status: 'Assinada', Resultado: r.resultado, AssinadoPor: usuario, DataAssinatura: stamp
        });
        // atualiza o instrumento: última/próxima calibração
        const meses = Number(inst.IntervaloMeses) || 12;
        await DB.update('instrumentos', inst.ID, {
          UltimaCal: cab.Data,
          ProximaCal: Domain.addDaysISO(cab.Data, Math.round(meses * 30.44)),
          Status: r.resultado === 'Reprovado' ? 'Bloqueado' : (inst.Status === 'Em calibração' ? 'Ativo' : inst.Status)
        });
        if (r.resultado === 'Reprovado') {
          await DB.insert('ocorrencias', {
            ID: await DB.nextSeqId('OC', 'ocorrencias'), Data: cab.Data, Instrumento: inst.ID,
            Tipo: 'Reprovação', Descricao: 'Reprovado na calibração ' + cal.ID + ' — instrumento bloqueado.',
            Responsavel: usuario, Status: 'Aberta'
          });
        }
        await DB.audit('Assinatura', 'Calibracao', cal.ID, 'Assinada por ' + usuario + ' — ' + (r.resultado || 'sem resultado'));
        UI.toast('Calibração ' + cal.ID + ' assinada — ' + (r.resultado || '') + '.');
      } else {
        await DB.audit('Rascunho', 'Calibracao', cal.ID, 'Rascunho salvo.');
        UI.toast('Rascunho ' + cal.ID + ' salvo.');
      }
      App.go('calibracoes/' + cal.ID);
    }

    render();
  }

  /* --- certificado (visão de impressão) --------------------------------------- */

  function certificado(cal, inst, pontos, appCrit) {
    const ema = appCrit ? Number(appCrit.EMA) : null;
    const regra = cal.Regra || 'guarda';
    const regraNome = { simples: 'Aceitação simples', guarda: 'Banda de guarda', tur: 'Razão TUR ≥ 4:1' }[regra];

    const body = h('div');
    body.innerHTML =
      '<div style="text-align:center;border-bottom:2px solid var(--ink);padding-bottom:10px;margin-bottom:12px">' +
        '<b style="font-size:16px">MetroCal — Certificado de Calibração</b>' +
        '<div class="muted">' + esc(cal.ID || '(rascunho)') + '</div></div>' +
      '<dl class="klist">' +
        '<dt>Instrumento</dt><dd>' + esc(inst.ID) + ' — ' + esc(inst.Descricao) + '</dd>' +
        '<dt>Fabricante / modelo</dt><dd>' + esc((inst.Fabricante || '') + ' ' + (inst.Modelo || '')) + '</dd>' +
        '<dt>Nº de série</dt><dd>' + esc(inst.NumSerie || '—') + '</dd>' +
        '<dt>Faixa de medição</dt><dd>' + fmtNum(inst.FaixaMin, 0) + '–' + fmtNum(inst.FaixaMax, 0) + ' ' + esc(inst.Unidade) + '</dd>' +
        '<dt>Data</dt><dd>' + fmtDate(cal.Data) + '</dd>' +
        '<dt>Metrologista</dt><dd>' + esc(cal.Metrologista || '—') + '</dd>' +
        '<dt>Procedimento</dt><dd>' + esc(cal.Procedimento || '—') + '</dd>' +
        '<dt>Condições ambientais</dt><dd>' + fmtNum(cal.Temperatura, 1) + ' °C · ' + fmtNum(cal.Umidade, 0) + ' %UR</dd>' +
        '<dt>Regra de decisão</dt><dd>' + esc(regraNome) + ' (ILAC G8)</dd>' +
      '</dl>' +
      '<table class="tbl mt"><thead><tr><th>Ponto</th><th class="num">Nominal</th><th class="num">Padrão</th>' +
      '<th class="num">Lido (média)</th><th class="num">Erro</th><th class="num">U (k=2)</th>' +
      (ema !== null ? '<th class="num">EMA</th><th>Avaliação</th>' : '') + '</tr></thead><tbody>' +
      pontos.filter(p => p.Media !== null).map(p => {
        const aval = ema !== null ? Domain.evaluate(p.Erro, p.U, ema, regra) : null;
        return '<tr><td>' + esc(p.Ponto || '') + '</td><td class="num">' + fmtNum(p.Nominal, 3) + '</td>' +
          '<td class="num">' + fmtNum(p.Padrao, 3) + '</td><td class="num">' + fmtNum(p.Media, 3) + '</td>' +
          '<td class="num">' + fmtSigned(p.Erro, 3) + '</td><td class="num">' + fmtNum(p.U, 3) + '</td>' +
          (ema !== null ? '<td class="num">' + fmtNum(ema, 3) + '</td><td>' + (aval ? (aval.ok ? 'Atende' : 'Não atende') : '—') + '</td>' : '') +
        '</tr>';
      }).join('') + '</tbody></table>' +
      (cal.Resultado ? '<div class="resultbox ' + (cal.Resultado === 'Aprovado' ? 'ok' : cal.Resultado === 'Reprovado' ? 'err' : 'warn') + ' mt">' + esc(cal.Resultado) + '</div>' : '') +
      '<div class="row between mt" style="margin-top:34px">' +
        '<div style="text-align:center"><div style="border-top:1px solid var(--ink);padding-top:4px;width:210px">Metrologista</div></div>' +
        '<div style="text-align:center"><div style="border-top:1px solid var(--ink);padding-top:4px;width:210px">Aprovação' +
          (cal.AssinadoPor ? ' — ' + esc(cal.AssinadoPor) : '') + '</div></div>' +
      '</div>';

    UI.modal({
      title: 'Certificado — ' + (cal.ID || 'rascunho'), body: body, wide: true,
      actions: [
        { label: 'Fechar', onClick: c => c() },
        { label: 'Imprimir / PDF', cls: 'solid', icon: 'printer', onClick: () => window.print() }
      ]
    });
  }

  /* =========================================================================
   * MATRIZ DE CONFORMIDADE — instrumento × aplicação
   * ====================================================================== */

  async function matriz(view) {
    const data = await ctx();
    const insts = data.instrumentos.filter(i => i.Status !== 'Baixado');
    const apps = data.aplicacoes;
    let sel = null; // {instId, appId}

    function cellStatus(instId, app) {
      const vinc = data.vinculos.find(v => String(v.Instrumento) === String(instId)
        && String(v.Aplicacao) === String(app.ID) && String(v.Ativo) !== '0');
      if (!vinc) return null;
      return Domain.appStatus(data, instId, app, data.regraPadrao);
    }

    view.innerHTML =
      '<div class="row mb">' +
        UI.chip('Atende') + UI.chip('Atende parcialmente') + UI.chip('Não atende') +
        '<span class="chip mute">— Sem vínculo</span>' +
        '<div style="flex:1"></div>' +
        '<span class="muted" style="font-size:11.5px">Regra de decisão: ' +
          ({ simples: 'aceitação simples', guarda: 'banda de guarda (ILAC G8)', tur: 'razão TUR ≥ 4:1' })[data.regraPadrao] +
          ' · U expandida k = ' + data.k + '</span>' +
      '</div>' +
      '<div class="cols cols-21">' +
        '<div class="card" style="padding:6px 0"><table class="tbl matrix"><thead><tr><th>Instrumento</th>' +
          apps.map(a => '<th>' + esc(a.ID) + '<small>EMA ' + fmtNum(a.EMA, 3) + ' ' + esc(a.Unidade) + '</small></th>').join('') +
          '</tr></thead><tbody>' +
          insts.map(i => '<tr><td><b>' + esc(i.ID) + '</b><div class="muted" style="font-size:11px">' + esc(i.Descricao)
            + (i.Status === 'Bloqueado' ? ' · bloq.' : '') + '</div></td>' +
            apps.map(a => {
              const st = cellStatus(i.ID, a);
              if (!st) return '<td class="mcell m-none"><div>—</div></td>';
              const cls = st.status === 'ok' ? 'm-ok' : st.status === 'part' ? 'm-part' : st.status === 'no' ? 'm-no' : 'm-none';
              const glyph = st.status === 'ok' ? '✓' : st.status === 'part' ? '!' : st.status === 'no' ? '✗' : '—';
              return '<td class="mcell ' + cls + '" data-sel="' + esc(i.ID) + '|' + esc(a.ID) + '"><div>' + glyph + '</div></td>';
            }).join('') + '</tr>').join('') +
          '</tbody></table></div>' +
        '<div class="card"><div class="card-hd"><h3>Avaliação detalhada</h3></div><div id="detail">' +
          '<div class="empty">Clique em uma célula da matriz para ver a avaliação.</div></div></div>' +
      '</div>';

    function drawDetail() {
      const box = q(view, '#detail');
      if (!sel) return;
      const [instId, appId] = sel.split('|');
      const app = apps.find(a => String(a.ID) === appId);
      const inst = insts.find(i => String(i.ID) === instId);
      const st = Domain.appStatus(data, instId, app, data.regraPadrao);
      if (!st.pior) { box.innerHTML = '<div class="empty">' + esc(st.motivo || 'Sem dados.') + '</div>'; return; }

      const p = st.pior;
      const statusLbl = st.status === 'ok' ? 'Atende' : st.status === 'part' ? 'Atende parcialmente' : 'Não atende';
      box.innerHTML =
        '<div class="mb"><b style="color:var(--blue)">' + esc(instId) + '</b> × <b style="color:var(--blue)">' + esc(appId) + '</b></div>' +
        '<dl class="klist">' +
          '<dt>Erro no ponto de ' + fmtNum(p.nominal, 0) + ' ' + esc(app.Unidade) + '</dt><dd>' + fmtSigned(p.erro, 3) + ' ' + esc(app.Unidade) + '</dd>' +
          '<dt>Incerteza U (k = ' + data.k + ')</dt><dd>' + fmtNum(p.U, 3) + ' ' + esc(app.Unidade) + '</dd>' +
          '<dt>EMA da aplicação</dt><dd>' + fmtNum(p.ema, 3) + ' ' + esc(app.Unidade) + '</dd>' +
          '<dt>Banda de guarda w = U</dt><dd>' + fmtNum(p.U, 3) + ' ' + esc(app.Unidade) + '</dd>' +
          '<dt>Limite de aceitação</dt><dd>' + fmtNum(p.limite, 3) + ' ' + esc(app.Unidade) + '</dd>' +
        '</dl>' +
        '<div class="row between"><span>' + UI.chip(statusLbl) + '</span>' +
          '<b class="' + (st.status === 'ok' ? '' : 'bad') + '" style="font-size:12px">'
          + fmtNum(Math.abs(p.erro), 3) + ' ' + (st.status === 'ok' ? '≤' : '>') + ' ' + fmtNum(p.limite, 3) + ' ' + esc(app.Unidade) + '</b></div>' +
        '<div class="notebox">O mesmo instrumento pode atender a outra aplicação com folga. A conformidade é uma ' +
          'propriedade do par instrumento × aplicação, não do instrumento isolado.</div>' +
        '<div class="muted" style="font-size:11px">' + st.atendidos + ' de ' + st.pontos + ' ponto(s) atendem · calibração '
          + esc(st.cal ? st.cal.ID : '—') + '</div>' +
        '<div class="mt"><button class="btn block" id="btnVinc">' + icon('link') + ' Vincular a outra aplicação</button></div>' +
        '<div class="muted mt" style="font-size:11px;text-align:center">Alterações registradas na trilha de auditoria</div>';

      q(view, '#btnVinc').addEventListener('click', () => manageLinks(inst));
    }

    qa(view, '[data-sel]').forEach(td => td.addEventListener('click', () => {
      sel = td.getAttribute('data-sel');
      drawDetail();
    }));
  }

  /* =========================================================================
   * APLICAÇÕES
   * ====================================================================== */

  async function aplicacoes(view) {
    const data = await ctx();

    view.innerHTML =
      '<div class="filters"><div class="muted" style="font-size:12px">Requisitos do processo: faixa de uso e erro máximo admissível (EMA) por aplicação.</div>' +
      '<div style="flex:1"></div><button class="btn solid" id="btnNew">' + icon('plus') + ' Nova aplicação</button></div>' +
      '<div class="card" style="padding:6px 0 2px"><table class="tbl"><thead><tr>' +
      '<th>ID</th><th>Descrição</th><th>Grandeza</th><th>Faixa de uso</th><th class="num">EMA</th><th>Regra</th><th>Instrumentos</th>' +
      '</tr></thead><tbody>' +
      data.aplicacoes.map(a => {
        const nInst = data.vinculos.filter(v => String(v.Aplicacao) === String(a.ID) && String(v.Ativo) !== '0').length;
        return '<tr data-id="' + esc(a.ID) + '">' +
          '<td class="rowid">' + esc(a.ID) + '</td><td>' + esc(a.Descricao) + '</td>' +
          '<td>' + esc(a.Grandeza) + '</td>' +
          '<td>' + fmtNum(a.FaixaMin, 0) + '–' + fmtNum(a.FaixaMax, 0) + ' ' + esc(a.Unidade) + '</td>' +
          '<td class="num b">' + fmtNum(a.EMA, 3) + ' ' + esc(a.Unidade) + '</td>' +
          '<td>' + ({ simples: 'Aceitação simples', guarda: 'Banda de guarda', tur: 'TUR ≥ 4:1' })[a.Regra || 'guarda'] + '</td>' +
          '<td>' + nInst + '</td></tr>';
      }).join('') +
      '</tbody></table></div>';

    q(view, '#btnNew').addEventListener('click', () => aplicacaoModal(null));
    qa(view, 'tr[data-id]').forEach(tr => tr.addEventListener('click', () => aplicacaoModal(tr.getAttribute('data-id'))));
  }

  async function aplicacaoModal(id) {
    const data = await ctx();
    const a = id ? data.aplicacoes.find(x => String(x.ID) === String(id)) : {
      ID: await DB.nextSeqId('AP', 'aplicacoes'), Grandeza: 'Dimensional', Unidade: 'mm', Regra: data.regraPadrao
    };
    const body = h('div');
    body.innerHTML = '<div class="fgrid c2">' +
      fld('Identificação', 'aID', a.ID, id ? 'disabled' : '') +
      fld('Descrição', 'aDesc', a.Descricao) +
      fld('Grandeza', 'aGr', a.Grandeza) +
      fld('Unidade', 'aUn', a.Unidade) +
      fld('Faixa de uso — mín.', 'aMin', a.FaixaMin) +
      fld('Faixa de uso — máx.', 'aMax', a.FaixaMax) +
      fld('EMA (erro máximo admissível)', 'aEMA', a.EMA) +
      '<label class="f"><span>Regra de decisão</span><select class="in" id="aRegra">' +
        [['simples', 'Aceitação simples'], ['guarda', 'Banda de guarda'], ['tur', 'Razão TUR ≥ 4:1']]
          .map(r => '<option value="' + r[0] + '"' + ((a.Regra || 'guarda') === r[0] ? ' selected' : '') + '>' + r[1] + '</option>').join('') +
      '</select></label></div>' +
      fld('Observações', 'aObs', a.Obs);

    UI.modal({
      title: id ? 'Editar aplicação ' + id : 'Nova aplicação', body: body, wide: true,
      actions: [
        { label: 'Cancelar', onClick: c => c() },
        { label: 'Salvar', cls: 'solid', onClick: async (close, box) => {
          const g = s => box.querySelector(s).value;
          const patch = {
            Descricao: g('#aDesc').trim(), Grandeza: g('#aGr').trim(), Unidade: g('#aUn').trim(),
            FaixaMin: num(g('#aMin')), FaixaMax: num(g('#aMax')), EMA: num(g('#aEMA')),
            Regra: g('#aRegra'), Obs: g('#aObs').trim()
          };
          if (!patch.Descricao || patch.EMA === null) { UI.toast('Informe descrição e EMA.', 'err'); return; }
          if (id) {
            await DB.update('aplicacoes', id, patch);
            await DB.audit('Edição', 'Aplicacao', id, 'Aplicação atualizada.');
          } else {
            patch.ID = g('#aID').trim();
            await DB.insert('aplicacoes', patch);
            await DB.audit('Cadastro', 'Aplicacao', patch.ID, 'Aplicação cadastrada: ' + patch.Descricao);
          }
          close(); UI.toast('Aplicação salva.'); App.refresh();
        } }
      ]
    });
  }

  /* =========================================================================
   * AGENDA
   * ====================================================================== */

  async function agenda(view) {
    const data = await ctx();
    const instPorId = {};
    data.instrumentos.forEach(i => instPorId[i.ID] = i);
    const itens = data.agenda.slice().sort((a, b) => String(a.DataPrevista).localeCompare(String(b.DataPrevista)));

    view.innerHTML =
      '<div class="card" style="padding:6px 0 2px"><table class="tbl"><thead><tr>' +
      '<th>Instrumento</th><th>Descrição</th><th>Data prevista</th><th>Responsável</th><th>Status</th><th>Observação</th><th style="width:120px"></th>' +
      '</tr></thead><tbody>' +
      (itens.length ? itens.map(a => {
        const inst = instPorId[a.Instrumento];
        const d = a.DataPrevista ? Domain.diffDays(a.DataPrevista, Domain.todayISO()) : null;
        return '<tr>' +
          '<td class="rowid">' + esc(a.Instrumento) + '</td>' +
          '<td>' + esc(inst ? inst.Descricao : '—') + '</td>' +
          '<td class="' + (d !== null && d < 0 ? 'bad' : '') + '">' + fmtDate(a.DataPrevista) +
            (d !== null && d >= 0 && d <= data.diasAlerta ? ' <span class="muted">(' + d + ' d)</span>' : '') + '</td>' +
          '<td>' + esc(a.Responsavel || '—') + '</td>' +
          '<td>' + UI.chip(a.Status) + '</td>' +
          '<td class="muted">' + esc(a.Obs || '') + '</td>' +
          '<td class="nowrap">' +
            (a.Status === 'Agendada' || a.Status === 'Em calibração'
              ? '<button class="btn sm" data-cal="' + esc(a.ID) + '|' + esc(a.Instrumento) + '">' + icon('cals') + ' Calibrar</button>' +
                '<button class="btn sm ghost" data-canc="' + esc(a.ID) + '">Cancelar</button>'
              : '') +
          '</td></tr>';
      }).join('') : '<tr><td colspan="7" class="empty">Agenda vazia.</td></tr>') +
      '</tbody></table></div>';

    qa(view, '[data-cal]').forEach(b => b.addEventListener('click', async () => {
      const [agId, instId] = b.getAttribute('data-cal').split('|');
      await DB.update('agenda', agId, { Status: 'Em calibração' });
      App.go('calibracoes/nova/' + instId);
    }));
    qa(view, '[data-canc]').forEach(b => b.addEventListener('click', async () => {
      if (!(await UI.confirmBox('Cancelar este agendamento?', 'Cancelar agendamento'))) return;
      await DB.update('agenda', b.getAttribute('data-canc'), { Status: 'Cancelada' });
      await DB.audit('Agendamento', 'Agenda', b.getAttribute('data-canc'), 'Agendamento cancelado.');
      agenda(view);
    }));
  }

  /* =========================================================================
   * RELATÓRIOS — auditoria
   * ====================================================================== */

  async function relatorios(view) {
    const data = await ctx();

    view.innerHTML =
      '<div class="cols cols-3">' +
        repCard('cals', 'cals', 'Calibrações', 'Todas as calibrações com resultado, metrologista e assinatura.') +
        repCard('venc', 'calendar', 'Vencimentos', 'Instrumentos e a data da próxima calibração — o que vence primeiro.') +
        repCard('aud', 'lock', 'Trilha de auditoria', 'Histórico imutável de ações: quem fez, o quê e quando (ISO 17025 / IATF 16949).') +
      '</div>' +
      '<div class="card" id="repOut"><div class="empty">Escolha um relatório acima.</div></div>';

    qa(view, '[data-rep]').forEach(b => b.addEventListener('click', () => gerar(b.getAttribute('data-rep'))));

    function repCard(key, ic, titulo, texto) {
      return '<div class="card"><div class="card-hd"><h3>' + titulo + '</h3></div>' +
        '<p class="muted" style="font-size:12px;margin:0 0 12px">' + texto + '</p>' +
        '<div class="row"><button class="btn solid sm" data-rep="' + key + '">' + icon('report') + ' Gerar</button>' +
        '<button class="btn sm" data-csv="' + key + '">' + icon('download') + ' CSV</button></div></div>';
    }

    qa(view, '[data-csv]').forEach(b => b.addEventListener('click', () => {
      const [header, linhas] = dataset(b.getAttribute('data-csv'));
      App.downloadCsv(b.getAttribute('data-csv') + '.csv', [header].concat(linhas));
    }));

    function dataset(tipo) {
      if (tipo === 'cals') {
        return [['ID','Instrumento','Data','Metrologista','Tipo','Resultado','Status','AssinadoPor','DataAssinatura'],
          data.calibracoes.map(c => [c.ID, c.Instrumento, fmtDate(c.Data), c.Metrologista, c.Tipo, c.Resultado, c.Status, c.AssinadoPor, fmtDateTime(c.DataAssinatura)])];
      }
      if (tipo === 'venc') {
        return [['Instrumento','Descricao','Responsavel','UltimaCal','ProximaCal','Status'],
          data.instrumentos.map(i => [i.ID, i.Descricao, i.Responsavel, fmtDate(i.UltimaCal), fmtDate(i.ProximaCal), i.Status])];
      }
      return [['ID','DataHora','Usuario','Acao','Entidade','EntidadeID','Detalhe'],
        data.auditoria ? data.auditoria.map(a => [a.ID, fmtDateTime(a.DataHora), a.Usuario, a.Acao, a.Entidade, a.EntidadeID, a.Detalhe]) : []];
    }

    async function gerar(tipo) {
      const d2 = await ctx();
      d2.auditoria = await DB.table('auditoria');
      const out = q(view, '#repOut');
      let html = '';
      if (tipo === 'cals') {
        const list = d2.calibracoes.slice().sort((a, b) => String(b.Data).localeCompare(String(a.Data)));
        html = '<div class="card-hd"><h3>Relatório de calibrações</h3><button class="link no-print" onclick="window.print()">imprimir</button></div>' +
          '<table class="tbl"><thead><tr><th>ID</th><th>Instrumento</th><th>Data</th><th>Metrologista</th><th>Resultado</th><th>Assinada por</th></tr></thead><tbody>' +
          list.map(c => '<tr><td class="mono">' + esc(c.ID) + '</td><td>' + esc(c.Instrumento) + '</td><td>' + fmtDate(c.Data) + '</td>' +
            '<td>' + esc(c.Metrologista || '—') + '</td><td>' + resultadoChip(c.Resultado) + '</td>' +
            '<td>' + esc(c.AssinadoPor || '—') + (c.DataAssinatura ? ' · ' + fmtDateTime(c.DataAssinatura) : '') + '</td></tr>').join('') +
          '</tbody></table>';
      } else if (tipo === 'venc') {
        const list = d2.instrumentos.filter(i => i.Status !== 'Baixado' && i.ProximaCal)
          .sort((a, b) => a.ProximaCal.localeCompare(b.ProximaCal));
        html = '<div class="card-hd"><h3>Relatório de vencimentos</h3><button class="link no-print" onclick="window.print()">imprimir</button></div>' +
          '<table class="tbl"><thead><tr><th>Instrumento</th><th>Descrição</th><th>Responsável</th><th>Última</th><th>Próxima</th><th>Situação</th></tr></thead><tbody>' +
          list.map(i => {
            const due = Domain.dueStatus(i, d2.diasAlerta);
            return '<tr><td class="rowid">' + esc(i.ID) + '</td><td>' + esc(i.Descricao) + '</td><td>' + esc(i.Responsavel || '—') + '</td>' +
              '<td>' + fmtDate(i.UltimaCal) + '</td><td class="' + (due.kind === 'err' ? 'bad' : '') + '">' + fmtDate(i.ProximaCal) + '</td>' +
              '<td>' + UI.chip(due.label) + '</td></tr>';
          }).join('') + '</tbody></table>';
      } else {
        const list = d2.auditoria.slice().sort((a, b) => String(b.DataHora).localeCompare(String(a.DataHora)));
        html = '<div class="card-hd"><h3>Trilha de auditoria</h3><button class="link no-print" onclick="window.print()">imprimir</button></div>' +
          '<table class="tbl"><thead><tr><th>Quando</th><th>Usuário</th><th>Ação</th><th>Entidade</th><th>Registro</th><th>Detalhe</th></tr></thead><tbody>' +
          list.map(a => '<tr><td class="nowrap">' + fmtDateTime(a.DataHora) + '</td><td>' + esc(a.Usuario) + '</td>' +
            '<td>' + esc(a.Acao) + '</td><td>' + esc(a.Entidade) + '</td><td class="mono">' + esc(a.EntidadeID) + '</td>' +
            '<td>' + esc(a.Detalhe) + '</td></tr>').join('') + '</tbody></table>';
      }
      out.innerHTML = html;
    }
  }

  /* =========================================================================
   * CONFIGURAÇÕES
   * ====================================================================== */

  async function configuracoes(view) {
    const data = await ctx();
    const usuario = await DB.currentUser();
    const ext = Files.isExternal();

    view.innerHTML =
      '<div class="cols cols-2">' +
        '<div class="card"><div class="card-hd"><h3>Regras de conformidade</h3></div>' +
          '<label class="f"><span>Regra de decisão padrão (ILAC G8)</span><select class="in" id="cfRegra">' +
            [['simples', 'Aceitação simples — |erro| ≤ EMA'], ['guarda', 'Banda de guarda — |erro| ≤ EMA − U'], ['tur', 'Razão TUR ≥ 4:1']]
              .map(r => '<option value="' + r[0] + '"' + (data.regraPadrao === r[0] ? ' selected' : '') + '>' + r[1] + '</option>').join('') +
          '</select></label>' +
          fld('Fator de abrangência k', 'cfK', data.k) +
          fld('Alerta de vencimento (dias)', 'cfDias', data.diasAlerta) +
          '<button class="btn solid" id="cfSave">' + icon('check') + ' Salvar</button>' +
        '</div>' +

        '<div class="card"><div class="card-hd"><h3>Usuário e perfis</h3></div>' +
          '<label class="f"><span>Usuário atual (registrado na trilha de auditoria)</span><select class="in" id="cfUser">' +
            data.usuarios.map(u => '<option' + (u.Nome === usuario ? ' selected' : '') + '>' + esc(u.Nome) + ' · ' + esc(u.Perfil) + '</option>').join('') +
          '</select></label>' +
          '<table class="tbl"><thead><tr><th>Nome</th><th>Perfil</th></tr></thead><tbody>' +
            data.usuarios.map(u => '<tr><td>' + esc(u.Nome) + '</td><td>' + esc(u.Perfil) + '</td></tr>').join('') +
          '</tbody></table>' +
          '<div class="row mt"><input class="in" id="cfNome" placeholder="Nome" style="flex:2">' +
          '<select class="in" id="cfPerfil" style="flex:1"><option>Metrologista</option><option>Aprovador</option><option>Consulta</option></select>' +
          '<button class="btn" id="cfAddUser">' + icon('plus') + '</button></div>' +
        '</div>' +
      '</div>' +

      '<div class="cols cols-2">' +
        '<div class="card"><div class="card-hd"><h3>Armazenamento de arquivos</h3></div>' +
          (ext
            ? '<p style="font-size:12.5px;color:var(--soft)">Fotos e PDFs estão sendo gravados como arquivos na pasta <b>arquivos/</b>, ao lado da pasta de trabalho.</p>'
            : '<p style="font-size:12.5px;color:var(--soft)">Add-in sem os handlers de arquivo (projeto não compilado): fotos e PDFs estão embutidos na aba <b>Arquivos</b> da pasta de trabalho. Para gravar na pasta <b>arquivos/</b>, compile o projeto no Ribdim (Build) e exporte novamente.</p>') +
        '</div>' +

        '<div class="card"><div class="card-hd"><h3>Dados</h3></div>' +
          '<p style="font-size:12.5px;color:var(--soft);margin-top:0">Repor o conjunto de dados de exemplo. Substitui o conteúdo atual de todas as abas do sistema.</p>' +
          '<button class="btn danger" id="cfReset">' + icon('alert') + ' Recarregar dados de exemplo</button>' +
        '</div>' +
      '</div>';

    q(view, '#cfSave').addEventListener('click', async () => {
      await DB.config('regraPadrao', q(view, '#cfRegra').value);
      await DB.config('k', q(view, '#cfK').value || '2');
      await DB.config('diasAlerta', q(view, '#cfDias').value || '30');
      await DB.config('usuarioAtual', q(view, '#cfUser').value.split(' · ')[0]);
      await DB.audit('Configuração', 'Config', '-', 'Regra/k/alerta/usuário atualizados.');
      UI.toast('Configurações salvas.');
      App.fillUser();
      App.refresh();
    });

    q(view, '#cfAddUser').addEventListener('click', async () => {
      const nome = q(view, '#cfNome').value.trim();
      if (!nome) { UI.toast('Informe o nome.', 'err'); return; }
      await DB.insert('usuarios', { ID: await DB.nextSeqId('U', 'usuarios'), Nome: nome, Perfil: q(view, '#cfPerfil').value });
      await DB.audit('Cadastro', 'Usuario', nome, 'Usuário cadastrado: ' + nome);
      UI.toast('Usuário cadastrado.');
      configuracoes(view);
    });

    q(view, '#cfReset').addEventListener('click', async () => {
      if (!(await UI.confirmBox('Substituir TODOS os dados pelos dados de exemplo?', 'Recarregar'))) return;
      await DB.reset();
      await DB.audit('Reset', 'Sistema', '-', 'Dados de exemplo recarregados.');
      UI.toast('Dados de exemplo recarregados.');
      App.go('dashboard');
    });
  }

  return {
    dashboard, instrumentos, instrumento, historico, padroes, padrao,
    calibracoes, calibracao, matriz, aplicacoes, agenda, relatorios, configuracoes
  };
})();
