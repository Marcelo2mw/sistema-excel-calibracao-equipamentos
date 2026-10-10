/* ===========================================================================
 * MetroCal — utilitários de interface
 * DOM, ícones (SVG inline), formatação pt-BR, chips, modais, toasts e os
 * gráficos em SVG puro — nada é buscado na rede, o painel tem de funcionar
 * numa máquina sem internet.
 * ======================================================================== */
'use strict';

const UI = (function () {

  /* --- DOM ------------------------------------------------------------------ */

  function h(tag, attrs) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k of Object.keys(attrs)) {
        if (k === 'html') el.innerHTML = attrs[k];
        else if (k === 'text') el.textContent = attrs[k];
        else if (k.slice(0, 2) === 'on' && typeof attrs[k] === 'function') el.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) el.setAttribute(k, attrs[k]);
      }
    }
    for (let i = 2; i < arguments.length; i++) {
      const c = arguments[i];
      if (c === null || c === undefined) continue;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return el;
  }

  /* --- ícones (traço estilo Lucide, viewBox 24) ------------------------------- */

  const ICONS = {
    dashboard: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.1-2.1 2.7-2.5z"/>',
    award: '<circle cx="12" cy="9" r="5"/><path d="M8.5 13.5L7 21l5-2.5L17 21l-1.5-7.5"/>',
    cals: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 12l2 2 4-4"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    report: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.7a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2l.4 2.7h4l.4-2.7a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5A7 7 0 0 0 19 12z"/>',
    bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    dots: '<circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    alert: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    ban: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
    trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z"/><path d="M14 3v5h5"/>',
    check: '<path d="M4 12.5l5 5L20 6.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    arrowR: '<path d="M4 12h16M14 6l6 6-6 6"/>',
    printer: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 20h16"/>',
    download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 20h16"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    thermo: '<path d="M10 4a2 2 0 0 1 4 0v9.5a4.5 4.5 0 1 1-4 0V4z"/>',
    drop: '<path d="M12 3s6 6.5 6 11a6 6 0 1 1-12 0c0-4.5 6-11 6-11z"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    ruler: '<rect x="2" y="8" width="20" height="8" rx="1.5"/><path d="M7 8v3M11 8v4M15 8v3M19 8v4"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 8v4l3 2"/>'
  };

  function icon(name, cls) {
    return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      + (ICONS[name] || ICONS.dots) + '</svg>';
  }

  /* --- formatação pt-BR ------------------------------------------------------- */

  function fmtNum(n, dec) {
    if (n === null || n === undefined || n === '' || isNaN(Number(n))) return '—';
    const v = Number(n);
    const d = dec !== undefined ? dec : (Math.abs(v) < 1 && v !== 0 ? 3 : (Number.isInteger(v) ? 0 : 2));
    return v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  function fmtSigned(n, dec) {
    if (n === null || n === undefined || isNaN(Number(n))) return '—';
    const v = Number(n);
    return (v > 0 ? '+' : '') + fmtNum(v, dec !== undefined ? dec : 3);
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    const s = String(iso).slice(0, 10);
    const p = s.split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : s;
  }

  function fmtDateTime(isoLike) {
    if (!isoLike) return '—';
    const s = String(isoLike).replace('T', ' ');
    return fmtDate(s) + ' ' + s.slice(11, 16);
  }

  function initials(nome) {
    return String(nome || '?').trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
  }

  /* --- chips de status ------------------------------------------------------------ */

  const CHIP_KIND = {
    'Ativo': 'ok', 'Em calibração': 'info', 'Bloqueado': 'err', 'Baixado': 'mute',
    'Aprovado': 'ok', 'Aprovado c/ restrição': 'warn', 'Reprovado': 'err',
    'Agendada': 'info', 'Em andamento': 'warn', 'Aberta': 'warn', 'Encerrada': 'mute',
    'Concluída': 'ok', 'Cancelada': 'mute',
    'Vencida': 'err', 'A vencer': 'warn', 'Em dia': 'ok',
    'Rascunho': 'mute', 'Assinada': 'ok',
    'Atende': 'ok', 'Não atende': 'err', 'Atende parcialmente': 'warn',
    'Trabalho': 'info', 'Referência': 'warn', 'Primário': 'mute',
    'Deriva detectada': 'warn', 'Estável': 'ok',
    'Metrologista': 'info', 'Aprovador': 'ok', 'Consulta': 'mute'
  };

  function chip(status) {
    return '<span class="chip ' + (CHIP_KIND[status] || 'mute') + '">' + esc(status) + '</span>';
  }

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* --- toast ------------------------------------------------------------------------ */

  function toast(msg, kind) {
    const box = document.getElementById('toasts');
    const el = h('div', { class: 'toast ' + (kind || 'ok'), html: icon(kind === 'err' ? 'alert' : 'check') + '<span>' + esc(msg) + '</span>' });
    box.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 320); }, 3800);
  }

  /* --- modal ------------------------------------------------------------------------- */

  function modal(opts) {
    const overlay = h('div', { class: 'overlay' });
    const box = h('div', { class: 'modal' + (opts.wide ? ' wide' : '') });
    const close = () => overlay.remove();

    const hd = h('div', { class: 'modal-hd' },
      h('h3', { text: opts.title }),
      h('button', { class: 'iconbtn', html: icon('x'), onclick: close }));
    box.appendChild(hd);

    const body = h('div');
    if (typeof opts.body === 'string') body.innerHTML = opts.body;
    else if (opts.body) body.appendChild(opts.body);
    box.appendChild(body);

    if (opts.actions && opts.actions.length) {
      const ft = h('div', { class: 'modal-ft' });
      opts.actions.forEach(a => {
        ft.appendChild(h('button', {
          class: 'btn ' + (a.cls || ''),
          html: (a.icon ? icon(a.icon) : '') + esc(a.label),
          onclick: () => a.onClick && a.onClick(close, box)
        }, ));
      });
      box.appendChild(ft);
    }

    overlay.addEventListener('mousedown', e => { if (e.target === overlay && !opts.sticky) close(); });
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    return { close, box };
  }

  function confirmBox(msg, okLabel) {
    return new Promise(resolve => {
      const m = modal({
        title: 'Confirmação',
        body: '<p style="margin:0 0 4px">' + esc(msg) + '</p>',
        actions: [
          { label: 'Cancelar', onClick: c => { c(); resolve(false); } },
          { label: okLabel || 'Confirmar', cls: 'solid', onClick: c => { c(); resolve(true); } }
        ]
      });
    });
  }

  // Lê um arquivo local como base64; fotos passam pelo canvas e viram JPEG ≤ 640px.
  function pickFile(accept, asPhoto) {
    return new Promise(resolve => {
      const input = h('input', { type: 'file', accept: accept || '*/*', style: 'display:none' });
      document.body.appendChild(input);
      input.addEventListener('change', () => {
        const f = input.files[0];
        input.remove();
        if (!f) return resolve(null);
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result;
          if (!asPhoto) {
            return resolve({ name: f.name, base64: String(dataUrl).split(',')[1] });
          }
          const img = new Image();
          img.onload = () => {
            const max = 640;
            const scale = Math.min(1, max / Math.max(img.width, img.height));
            const cv = document.createElement('canvas');
            cv.width = Math.round(img.width * scale);
            cv.height = Math.round(img.height * scale);
            cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
            // PNG, não JPEG: JPEG não tem canal alfa e os pixels transparentes
            // viram preto. PNG preserva a transparência do arquivo original.
            resolve({ name: f.name.replace(/\.\w+$/, '') + '.png', base64: cv.toDataURL('image/png').split(',')[1] });
          };
          img.onerror = () => resolve(null);
          img.src = dataUrl;
        };
        reader.readAsDataURL(f);
      });
      input.click();
    });
  }

  /* --- gráficos (SVG puro) ------------------------------------------------------------- */

  const CHART_COLORS = ['#1668b4', '#2fae7d', '#d9a441', '#7e6bc4', '#5b8db8', '#4f9de0'];

  function chartBars(o) {
    // o: { labels: [...], series: [{name, color, values: [...] }] }
    const W = 560, H = 220, padL = 30, padB = 24, padT = 12;
    const max = Math.max(1, ...[].concat.apply([], o.series.map(s => s.values)));
    const iw = W - padL - 6, ih = H - padT - padB;
    const groups = o.labels.length, series = o.series.length;
    const gw = iw / groups, bw = Math.min(26, (gw - 10) / series);
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;display:block">';
    for (let i = 0; i <= 4; i++) {
      const y = padT + ih - (ih * i / 4);
      const val = Math.round(max * i / 4);
      s += '<line x1="' + padL + '" y1="' + y + '" x2="' + W + '" y2="' + y + '" stroke="#e6ecf3" stroke-width="1"/>'
        + '<text x="' + (padL - 5) + '" y="' + (y + 3) + '" font-size="9" fill="#8595a8" text-anchor="end">' + val + '</text>';
    }
    o.labels.forEach((lb, gi) => {
      const gx = padL + gw * gi;
      o.series.forEach((se, si) => {
        const v = se.values[gi] || 0;
        const bh = ih * v / max;
        const x = gx + (gw - bw * series) / 2 + si * bw;
        s += '<rect x="' + x.toFixed(1) + '" y="' + (padT + ih - bh).toFixed(1) + '" width="' + (bw - 3).toFixed(1)
          + '" height="' + Math.max(bh, v ? 2 : 0).toFixed(1) + '" rx="2.5" fill="' + se.color + '"><title>'
          + esc(lb) + ' — ' + esc(se.name) + ': ' + v + '</title></rect>';
      });
      s += '<text x="' + (gx + gw / 2) + '" y="' + (H - 7) + '" font-size="9.5" fill="#54657a" text-anchor="middle">' + esc(lb) + '</text>';
    });
    return s + '</svg>';
  }

  function chartDonut(slices, size) {
    const total = slices.reduce((a, b) => a + b.value, 0);
    const R = 62, C = 2 * Math.PI * R, cx = 90, cy = 90, sw = 24;
    let off = C * 0.25, s = '<svg viewBox="0 0 180 180" style="width:' + (size || 190) + 'px;height:auto;display:block;margin:0 auto">';
    if (!total) return s + '<circle cx="90" cy="90" r="62" fill="none" stroke="#eef1f5" stroke-width="24"/></svg>';
    slices.forEach((sl, i) => {
      const len = C * sl.value / total;
      s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="none" stroke="' + (sl.color || CHART_COLORS[i % CHART_COLORS.length])
        + '" stroke-width="' + sw + '" stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2)
        + '" stroke-dashoffset="' + off.toFixed(2) + '"><title>' + esc(sl.label) + ': ' + sl.value
        + ' (' + (100 * sl.value / total).toFixed(1) + '%)</title></circle>';
      off -= len;
    });
    s += '<text x="90" y="86" text-anchor="middle" font-size="22" font-weight="700" fill="#182230">' + total + '</text>'
      + '<text x="90" y="102" text-anchor="middle" font-size="9.5" fill="#8595a8">instrumentos</text>';
    return s + '</svg>';
  }

  function chartLine(o) {
    // o: { points: [{label, value}], ema, unit }
    const W = 620, H = 250, padL = 44, padB = 26, padT = 14, padR = 12;
    const vals = o.points.map(p => p.value);
    const max = Math.max.apply(null, vals.concat([o.ema || 0])) * 1.15 || 1;
    const min = Math.min(0, Math.min.apply(null, vals));
    const iw = W - padL - padR, ih = H - padT - padB;
    const X = i => padL + (o.points.length === 1 ? iw / 2 : iw * i / (o.points.length - 1));
    const Y = v => padT + ih - ih * (v - min) / (max - min);
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;display:block">';
    for (let i = 0; i <= 4; i++) {
      const v = min + (max - min) * i / 4, y = Y(v);
      s += '<line x1="' + padL + '" y1="' + y + '" x2="' + (W - padR) + '" y2="' + y + '" stroke="#e6ecf3"/>'
        + '<text x="' + (padL - 6) + '" y="' + (y + 3) + '" font-size="9" fill="#8595a8" text-anchor="end">'
        + v.toLocaleString('pt-BR', { maximumFractionDigits: 3 }) + '</text>';
    }
    if (o.ema !== null && o.ema !== undefined) {
      s += '<line x1="' + padL + '" y1="' + Y(o.ema) + '" x2="' + (W - padR) + '" y2="' + Y(o.ema)
        + '" stroke="#cf4040" stroke-width="1.6" stroke-dasharray="6 4"/>';
    }
    s += '<polyline fill="none" stroke="#1668b4" stroke-width="2.2" points="'
      + o.points.map((p, i) => X(i).toFixed(1) + ',' + Y(p.value).toFixed(1)).join(' ') + '"/>';
    o.points.forEach((p, i) => {
      s += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(p.value).toFixed(1) + '" r="4" fill="#1668b4" stroke="#fff" stroke-width="1.5">'
        + '<title>' + esc(p.label) + ': ' + fmtNum(p.value, 3) + (o.unit ? ' ' + esc(o.unit) : '') + '</title></circle>'
        + '<text x="' + X(i).toFixed(1) + '" y="' + (H - 8) + '" font-size="9.5" fill="#54657a" text-anchor="middle">' + esc(p.label) + '</text>';
    });
    return s + '</svg>';
  }

  function legend(items) {
    return '<div class="chart-legend">' + items.map(i =>
      '<span><i style="background:' + i.color + '"></i>' + esc(i.label) + '</span>').join('') + '</div>';
  }

  return { h, icon, fmtNum, fmtSigned, fmtDate, fmtDateTime, initials, chip, esc,
           toast, modal, confirmBox, pickFile, chartBars, chartDonut, chartLine, legend,
           CHART_COLORS };
})();
