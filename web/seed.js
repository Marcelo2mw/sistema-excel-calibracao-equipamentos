/* ===========================================================================
 * MetroCal — gravação dos dados de exemplo
 *
 * Os dados em si moram em seed-data.js (SeedData.build(), puro). Aqui só
 * gravamos cada bloco na sua aba, uma escrita por aba.
 * ======================================================================== */
'use strict';

const Seed = (function () {

  async function run() {
    const dados = SeedData.build();
    for (const key of Object.keys(dados)) {
      const meta = DB.SHEETS[key];
      if (!meta) continue;
      const rows = dados[key].map(o => meta.cols.map(c => o[c] === undefined ? null : o[c]));
      if (rows.length) await DB.call('writeRange', { sheet: meta.name, address: 'A2', rows: rows });
      await DB.call('autofitColumns', { sheet: meta.name });
    }

    /* capa na Planilha1 */
    try {
      await DB.call('writeCell', { sheet: 'Planilha1', address: 'A1', value: 'MetroCal — Gestão e Controle de Calibração' });
      await DB.call('setFont', { sheet: 'Planilha1', address: 'A1', bold: true, size: 14 });
      await DB.call('writeCell', { sheet: 'Planilha1', address: 'A2', value: 'Este arquivo é o banco de dados do sistema. Alimente e consulte pelo painel MetroCal (faixa MetroCal no Excel) — evite editar as abas diretamente.' });
      await DB.call('writeCell', { sheet: 'Planilha1', address: 'A3', value: 'Abas: Instrumentos, Padroes, Aplicacoes, Vinculos, Calibracoes, CalPontos, CalPadroes, Agenda, Ocorrencias, Auditoria, Usuarios, Config, Arquivos, Documentos.' });
      await DB.call('autofitColumns', { sheet: 'Planilha1' });
    } catch (e) { /* Planilha1 pode ter outro nome; a capa é cosmética */ }
  }

  return { run: run };
})();
