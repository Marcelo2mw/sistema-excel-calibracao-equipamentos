/* ===========================================================================
 * MetroCal — shell: navegação, router por hash, busca global e boot.
 * ======================================================================== */
'use strict';

const App = (function () {

  const NAV = [
    { route: 'dashboard', label: 'Dashboard', icon: 'dashboard', crumb: 'Visão geral · Laboratório de Metrologia' },
    { route: 'instrumentos', label: 'Instrumentos', icon: 'wrench', crumb: 'Cadastro · Instrumentos de medição' },
    { route: 'padroes', label: 'Padrões', icon: 'award', crumb: 'Cadastro · Padrões e rastreabilidade' },
    { route: 'calibracoes', label: 'Calibrações', icon: 'cals', crumb: 'Calibrações · Registro e histórico' },
    { route: 'matriz', label: 'Matriz de conformidade', icon: 'grid', crumb: 'Instrumentos × Aplicações · ILAC G8' },
    { route: 'aplicacoes', label: 'Aplicações', icon: 'target', crumb: 'Cadastro · Requisitos do processo' },
    { route: 'agenda', label: 'Agenda', icon: 'calendar', crumb: 'Gestão · Programação de calibrações' },
    { route: 'relatorios', label: 'Relatórios', icon: 'report', crumb: 'Gestão · Auditoria e exportação' },
    { route: 'configuracoes', label: 'Configurações', icon: 'settings', crumb: 'Sistema · Configurações' }
  ];

  let alertasCache = [];

  /* --- navegação --------------------------------------------------------------- */

  function go(route) { location.hash = '#/' + route; }
  function refresh() { route(); }

  function setTitle(crumb, title) {
    document.getElementById('crumb').textContent = crumb;
    document.getElementById('title').textContent = title;
  }

  function markNav(routeBase) {
    document.querySelectorAll('.nav-item').forEach(b =>
      b.classList.toggle('active', b.getAttribute('data-route') === routeBase));
  }

  async function route() {
    const view = document.getElementById('view');
    const hash = (location.hash || '#/dashboard').slice(2);
    const [pathPart, queryPart] = hash.split('?');
    const segs = pathPart.split('/').filter(Boolean);
    const params = {};
    if (queryPart) queryPart.split('&').forEach(kv => {
      const [k, v] = kv.split('=');
      params[k] = decodeURIComponent(v || '');
    });

    const base = segs[0] || 'dashboard';
    markNav(base);

    try {
      if (base === 'dashboard') {
        setTitle(NAV[0].crumb, 'Dashboard');
        await Screens.dashboard(view);
      } else if (base === 'instrumentos' && segs[1] === 'novo') {
        setTitle('Instrumentos · Novo', 'Novo instrumento');
        await Screens.instrumento(view, 'novo');
      } else if (base === 'instrumentos' && segs[1] && segs[2] === 'historico') {
        setTitle('Instrumentos · ' + segs[1] + ' · Histórico e carta de controle', 'Histórico — ' + segs[1]);
        await Screens.historico(view, segs[1]);
      } else if (base === 'instrumentos' && segs[1]) {
        setTitle('Instrumentos · ' + segs[1] + ' · Cadastro', segs[1]);
        await Screens.instrumento(view, segs[1]);
      } else if (base === 'instrumentos') {
        setTitle(NAV[1].crumb, 'Instrumentos');
        await Screens.instrumentos(view, params);
      } else if (base === 'padroes' && segs[1]) {
        setTitle('Padrões · ' + segs[1], 'Padrão ' + segs[1]);
        await Screens.padrao(view, segs[1]);
      } else if (base === 'padroes') {
        setTitle(NAV[2].crumb, 'Padrões');
        await Screens.padroes(view);
      } else if (base === 'calibracoes' && segs[1] === 'nova') {
        setTitle('Calibrações · Registrar', 'Nova calibração');
        await Screens.calibracao(view, 'nova', segs[2]);
      } else if (base === 'calibracoes' && segs[1]) {
        setTitle('Calibrações · Registrar · ' + segs[1], 'Calibração ' + segs[1]);
        await Screens.calibracao(view, segs[1]);
      } else if (base === 'calibracoes') {
        setTitle(NAV[3].crumb, 'Calibrações');
        await Screens.calibracoes(view);
      } else if (base === 'matriz') {
        setTitle(NAV[4].crumb, 'Matriz de conformidade');
        await Screens.matriz(view);
      } else if (base === 'aplicacoes') {
        setTitle(NAV[5].crumb, 'Aplicações');
        await Screens.aplicacoes(view);
      } else if (base === 'agenda') {
        setTitle(NAV[6].crumb, 'Agenda');
        await Screens.agenda(view);
      } else if (base === 'relatorios') {
        setTitle(NAV[7].crumb, 'Relatórios');
        await Screens.relatorios(view);
      } else if (base === 'configuracoes') {
        setTitle(NAV[8].crumb, 'Configurações');
        await Screens.configuracoes(view);
      } else {
        go('dashboard');
      }
    } catch (e) {
      view.innerHTML = '<div class="card"><div class="empty">Falha ao carregar a tela: '
        + UI.esc(e.message || e) + '</div></div>';
    }
  }

  /* --- alertas (sino) ------------------------------------------------------------- */

  function setBell(alertas) {
    alertasCache = alertas || [];
    document.getElementById('bellDot').classList.toggle('hidden', !alertasCache.length);
  }

  function showAlerts() {
    const body = document.createElement('div');
    body.className = 'alist';
    body.innerHTML = alertasCache.length
      ? alertasCache.map(a =>
          '<div class="aitem" data-go="' + UI.esc(a.ref) + '"><span class="aic ' + a.sev + '">'
          + UI.icon('alert') + '</span><div class="atxt"><b>' + UI.esc(a.texto) + '</b></div></div>').join('')
      : '<div class="empty">Nenhum alerta no momento.</div>';
    const m = UI.modal({ title: 'Alertas', body: body, actions: [{ label: 'Fechar', onClick: c => c() }] });
    body.querySelectorAll('[data-go]').forEach(el => el.addEventListener('click', () => {
      m.close();
      go(el.getAttribute('data-go').replace(/^#?\//, ''));
    }));
  }

  /* --- busca global ------------------------------------------------------------------ */

  async function search(termo) {
    if (!termo.trim()) return;
    const data = await Domain.loadAll();
    const t = termo.toLowerCase();
    const exato = data.instrumentos.find(i => String(i.ID).toLowerCase() === t);
    if (exato) return go('instrumentos/' + exato.ID);
    const cal = data.calibracoes.find(c => String(c.ID).toLowerCase() === t);
    if (cal) return go('calibracoes/' + cal.ID);
    go('instrumentos?q=' + encodeURIComponent(termo));
  }

  /* --- CSV ------------------------------------------------------------------------------ */

  function downloadCsv(name, rows) {
    const sep = ';'; // Excel pt-BR espera ponto e vírgula
    const csv = '﻿' + rows.map(r => r.map(v => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(sep)).join('\r\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /* --- boot --------------------------------------------------------------------------------- */

  async function fillUser() {
    const nome = await DB.currentUser();
    const usuarios = await DB.table('usuarios');
    const u = usuarios.find(x => x.Nome === nome);
    document.getElementById('sbUserName').textContent = nome;
    document.getElementById('sbUserRole').textContent = u ? u.Perfil : '—';
    document.getElementById('sbAvatar').textContent = UI.initials(nome);
    document.getElementById('topAvatar').textContent = UI.initials(nome);
  }

  async function start() {
    document.getElementById('sbLogo').innerHTML = UI.icon('ruler');
    document.getElementById('searchIcon').innerHTML = UI.icon('search');
    document.getElementById('bellIcon').innerHTML = UI.icon('bell');

    const nav = document.getElementById('nav');
    NAV.forEach(n => {
      const b = document.createElement('button');
      b.className = 'nav-item';
      b.setAttribute('data-route', n.route);
      b.innerHTML = UI.icon(n.icon) + '<span>' + n.label + '</span>';
      b.addEventListener('click', () => go(n.route));
      nav.appendChild(b);
    });

    document.getElementById('btnAlerts').addEventListener('click', showAlerts);
    document.getElementById('globalSearch').addEventListener('keydown', e => {
      if (e.key === 'Enter') search(e.target.value);
    });
    document.getElementById('sbUser').addEventListener('click', () => go('configuracoes'));

    window.addEventListener('hashchange', route);

    if (!bridge.available()) {
      setTitle('Fora do Excel', 'MetroCal');
      document.getElementById('view').innerHTML =
        '<div class="card"><div class="empty">Esta página foi aberta fora do Excel — sem a ponte, nenhum dado pode ser lido. '
        + 'Abra a pasta de trabalho e use a faixa <b>MetroCal</b>.</div></div>';
      return;
    }

    const init = await DB.init(); // cria as abas e, na primeira vez, grava os dados de exemplo
    await Files.init();
    await fillUser();

    if (init.seeded) UI.toast('Dados de exemplo carregados na pasta de trabalho.');

    // botões da faixa do Excel
    bridge.on('ribbonAction', d => {
      const map = {
        dashboard: 'dashboard', instrumentos: 'instrumentos', padroes: 'padroes',
        calibracoes: 'calibracoes', matriz: 'matriz', agenda: 'agenda', relatorios: 'relatorios'
      };
      if (map[d.tag]) go(map[d.tag]);
    });

    await route();
  }

  document.addEventListener('DOMContentLoaded', start);

  return { go, refresh, setTitle, setBell, downloadCsv, fillUser };
})();
