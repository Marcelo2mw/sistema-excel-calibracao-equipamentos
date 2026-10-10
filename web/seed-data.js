/* ===========================================================================
 * MetroCal — dados de exemplo (dados puros, sem dependência da bridge)
 *
 * SeedData.build() devolve { <chaveDaAba>: [objetos] } — as mesmas linhas que
 * Seed.run() grava via bridge e que a injeção direta no .xlsm usa. Datas são
 * relativas ao dia da geração, para "vencido"/"a vencer" e o gráfico de 6
 * meses do dashboard fazerem sentido sempre.
 * ======================================================================== */
'use strict';

const SeedData = (function () {

  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function d(off) {
    const x = new Date(todayISO() + 'T12:00:00');
    x.setDate(x.getDate() + off);
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  }
  function ts(isoDate, hora) { return isoDate + 'T' + (hora || '10:30'); }

  /* --- gerador de calibrações --------------------------------------------- */

  // Uma calibração completa: cabeçalho + pontos + padrão usado.
  // spec: { inst, off, seq, res, metro, proc, temp, um, tipo, padrao, regra, obs,
  //         nominais: [..], erros: [..], us: [..], rep }
  function mkCal(spec, out) {
    const data = d(spec.off);
    const id = 'CAL-' + data.slice(0, 4) + '-' + String(spec.seq).padStart(4, '0');
    out.calibracoes.push({
      ID: id, Instrumento: spec.inst, Data: data, Metrologista: spec.metro,
      Procedimento: spec.proc, Temperatura: spec.temp, Umidade: spec.um,
      Tipo: spec.tipo || 'Interna', Resultado: spec.res, Regra: spec.regra || 'guarda',
      CertificadoRef: null, Status: 'Assinada', AssinadoPor: spec.aprov || 'Letícia Prado',
      DataAssinatura: ts(data, spec.hora), Obs: spec.obs || null
    });
    const n = spec.nominais.length;
    spec.nominais.forEach((nominal, i) => {
      const media = Math.round((nominal + spec.erros[i]) * 10000) / 10000;
      const rep = spec.rep || 0.001;
      out.pontos.push({
        Calibracao: id, Ordem: i + 1,
        Ponto: Math.round(100 * (i + 1) / n) + '%', Nominal: nominal,
        Padrao: nominal,
        R1: Math.round((media - rep) * 10000) / 10000, R2: media,
        R3: Math.round((media + rep) * 10000) / 10000,
        Media: media, Erro: spec.erros[i], U: spec.us[i], K: 2
      });
    });
    if (spec.padrao) out.calpadroes.push({ Calibracao: id, Padrao: spec.padrao });
    return id;
  }

  function build() {
    const out = {
      config: [], usuarios: [], instrumentos: [], padroes: [], aplicacoes: [],
      vinculos: [], calibracoes: [], pontos: [], calpadroes: [], agenda: [],
      ocorrencias: [], auditoria: [], documentos: [], arquivos: []
    };

    /* --- configurações ------------------------------------------------------ */
    out.config.push(
      { Chave: 'usuarioAtual', Valor: 'Ricardo Mendes' },
      { Chave: 'regraPadrao', Valor: 'guarda' },
      { Chave: 'k', Valor: '2' },
      { Chave: 'diasAlerta', Valor: '30' },
      { Chave: 'seqCal', Valor: '2000' }
    );

    /* --- usuários ------------------------------------------------------------ */
    out.usuarios.push(
      { ID: 'U-01', Nome: 'Ricardo Mendes', Perfil: 'Metrologista' },
      { ID: 'U-02', Nome: 'Letícia Prado', Perfil: 'Aprovador' },
      { ID: 'U-03', Nome: 'Carlos Nunes', Perfil: 'Metrologista' },
      { ID: 'U-04', Nome: 'Ana Souza', Perfil: 'Consulta' }
    );

    /* --- instrumentos ---------------------------------------------------------- */
    out.instrumentos.push(
      { ID: 'PQT-0142', Descricao: 'Paquímetro digital', Fabricante: 'Mitutoyo', Modelo: '500-151-30',
        NumSerie: '08341572', Localizacao: 'Metrologia — Sala 02', Responsavel: 'Ricardo Mendes',
        Status: 'Ativo', Grandeza: 'Dimensional', Unidade: 'mm', FaixaMin: 0, FaixaMax: 150,
        Resolucao: 0.01, Classe: '±0,02 mm', Saida: 'Digimatic / SPC', IntervaloMeses: 12,
        UltimaCal: d(-33), ProximaCal: d(332),
        Obs: 'Em uso na linha de usinagem 2. Folga no cursor observada — verificar na próxima manutenção preventiva.' },
      { ID: 'TRM-0087', Descricao: 'Termômetro digital', Fabricante: 'Fluke', Modelo: '1523',
        NumSerie: '4412007', Localizacao: 'Tratamento térmico', Responsavel: 'Letícia Prado',
        Status: 'Em calibração', Grandeza: 'Temperatura', Unidade: '°C', FaixaMin: -50, FaixaMax: 300,
        Resolucao: 0.1, Classe: '±0,5 °C', Saida: 'Display', IntervaloMeses: 12,
        UltimaCal: d(-349), ProximaCal: d(17) },
      { ID: 'MAN-0031', Descricao: 'Manômetro', Fabricante: 'Wika', Modelo: '232.50',
        NumSerie: 'WK-88412', Localizacao: 'Utilidades — casa de ar', Responsavel: 'Letícia Prado',
        Status: 'Ativo', Grandeza: 'Pressão', Unidade: 'bar', FaixaMin: 0, FaixaMax: 250,
        Resolucao: 0.5, Classe: 'Classe 1,0', Saida: 'Analógico', IntervaloMeses: 12,
        UltimaCal: d(-220), ProximaCal: d(145) },
      { ID: 'BAL-0005', Descricao: 'Balança analítica', Fabricante: 'Sartorius', Modelo: 'BCA623',
        NumSerie: 'SR-61022', Localizacao: 'Laboratório químico', Responsavel: 'Carlos Nunes',
        Status: 'Bloqueado', Grandeza: 'Massa', Unidade: 'g', FaixaMin: 0, FaixaMax: 620,
        Resolucao: 0.001, Classe: '±0,5 g', Saida: 'Digital / RS-232', IntervaloMeses: 12,
        UltimaCal: d(-359), ProximaCal: d(6),
        Obs: 'Reprovada na última calibração (erro de 1,2 g no ponto de 620 g). Aguardando ajuste.' },
      { ID: 'MIC-0073', Descricao: 'Micrômetro externo', Fabricante: 'Mitutoyo', Modelo: '293-240',
        NumSerie: '55218903', Localizacao: 'Usinagem — linha 2', Responsavel: 'Ricardo Mendes',
        Status: 'Ativo', Grandeza: 'Dimensional', Unidade: 'mm', FaixaMin: 0, FaixaMax: 25,
        Resolucao: 0.001, Classe: '±0,002 mm', Saida: 'Digimatic / SPC', IntervaloMeses: 12,
        UltimaCal: d(-381), ProximaCal: d(-16) },
      { ID: 'TRQ-0012', Descricao: 'Torquímetro', Fabricante: 'Sturtevant', Modelo: '810501',
        NumSerie: 'TQ-3345', Localizacao: 'Montagem — célula 4', Responsavel: 'Carlos Nunes',
        Status: 'Ativo', Grandeza: 'Torque', Unidade: 'N·m', FaixaMin: 5, FaixaMax: 50,
        Resolucao: 0.1, Classe: '±2 %', Saida: 'Digital', IntervaloMeses: 12,
        UltimaCal: d(-2), ProximaCal: d(363) },
      { ID: 'MMV-0009', Descricao: 'Multímetro', Fabricante: 'Fluke', Modelo: '87V',
        NumSerie: 'FL-99231', Localizacao: 'Manutenção elétrica', Responsavel: 'Ricardo Mendes',
        Status: 'Em calibração', Grandeza: 'Elétrica', Unidade: 'V', FaixaMin: 0, FaixaMax: 1000,
        Resolucao: 0.1, Classe: '±0,05 % + 2', Saida: 'Display', IntervaloMeses: 12,
        UltimaCal: d(-105), ProximaCal: d(260) },
      { ID: 'LXM-0021', Descricao: 'Luxímetro', Fabricante: 'Minipa', Modelo: 'MLM-1010',
        NumSerie: 'MN-7782', Localizacao: 'Qualidade — laboratório', Responsavel: 'Ana Souza',
        Status: 'Ativo', Grandeza: 'Fotométrica', Unidade: 'lx', FaixaMin: 0, FaixaMax: 200000,
        Resolucao: 1, Classe: '±3 %', Saida: 'Display', IntervaloMeses: 12,
        UltimaCal: d(-186), ProximaCal: d(179) },
      { ID: 'BAL-0011', Descricao: 'Balança contadora', Fabricante: 'Toledo', Modelo: 'ICS689',
        NumSerie: 'TD-51290', Localizacao: 'Almoxarifado', Responsavel: 'Carlos Nunes',
        Status: 'Baixado', Grandeza: 'Massa', Unidade: 'kg', FaixaMin: 0, FaixaMax: 15,
        Resolucao: 0.001, Classe: '±0,02 kg', Saida: 'Digital', IntervaloMeses: 12,
        UltimaCal: d(-700), ProximaCal: null,
        Obs: 'Baixada do sistema: substituída pela BAL-0012.' },
      { ID: 'PAQ-0202', Descricao: 'Paquímetro analógico', Fabricante: 'Mitutoyo', Modelo: '530-115',
        NumSerie: '22103401', Localizacao: 'Usinagem — linha 1', Responsavel: 'Carlos Nunes',
        Status: 'Ativo', Grandeza: 'Dimensional', Unidade: 'mm', FaixaMin: 0, FaixaMax: 200,
        Resolucao: 0.05, Classe: '±0,05 mm', Saida: 'Analógico', IntervaloMeses: 12,
        UltimaCal: d(-66), ProximaCal: d(299) },
      { ID: 'MIC-0074', Descricao: 'Micrômetro de profundidade', Fabricante: 'Starrett', Modelo: '445',
        NumSerie: 'ST-99120', Localizacao: 'Metrologia — Sala 02', Responsavel: 'Ricardo Mendes',
        Status: 'Ativo', Grandeza: 'Dimensional', Unidade: 'mm', FaixaMin: 0, FaixaMax: 50,
        Resolucao: 0.01, Classe: '±0,004 mm', Saida: 'Mecânico', IntervaloMeses: 12,
        UltimaCal: d(-25), ProximaCal: d(340),
        Obs: 'Reprovou em ' + d(-28).slice(0, 10) + ' no ponto de 50 mm; aprovado após ajuste.' },
      { ID: 'TTM-0201', Descricao: 'Termopar tipo K com indicador', Fabricante: 'Minipa', Modelo: 'MT-450',
        NumSerie: 'MN-3451', Localizacao: 'Tratamento térmico', Responsavel: 'Letícia Prado',
        Status: 'Ativo', Grandeza: 'Temperatura', Unidade: '°C', FaixaMin: 0, FaixaMax: 400,
        Resolucao: 0.1, Classe: '±1,5 °C', Saida: 'Display', IntervaloMeses: 12,
        UltimaCal: d(-45), ProximaCal: d(320) },
      { ID: 'BAL-0012', Descricao: 'Balança semianalítica', Fabricante: 'Shimadzu', Modelo: 'AUW220',
        NumSerie: 'SH-77821', Localizacao: 'Laboratório químico', Responsavel: 'Carlos Nunes',
        Status: 'Ativo', Grandeza: 'Massa', Unidade: 'g', FaixaMin: 0, FaixaMax: 220,
        Resolucao: 0.0001, Classe: '±0,001 g', Saida: 'Digital', IntervaloMeses: 12,
        UltimaCal: d(-5), ProximaCal: d(360) },
      { ID: 'MAN-0044', Descricao: 'Manômetro digital', Fabricante: 'Wika', Modelo: 'CPG500',
        NumSerie: 'WK-CPG-332', Localizacao: 'Utilidades — casa de ar', Responsavel: 'Letícia Prado',
        Status: 'Ativo', Grandeza: 'Pressão', Unidade: 'bar', FaixaMin: 0, FaixaMax: 400,
        Resolucao: 0.1, Classe: 'Classe 0,25', Saida: 'Digital', IntervaloMeses: 12,
        UltimaCal: d(-35), ProximaCal: d(330) },
      { ID: 'TRQ-0021', Descricao: 'Torquímetro de estalo', Fabricante: 'Gedore', Modelo: '4550',
        NumSerie: 'GD-5521', Localizacao: 'Montagem — célula 4', Responsavel: 'Carlos Nunes',
        Status: 'Ativo', Grandeza: 'Torque', Unidade: 'N·m', FaixaMin: 10, FaixaMax: 100,
        Resolucao: 0.5, Classe: '±3 %', Saida: 'Analógico', IntervaloMeses: 12,
        UltimaCal: d(-111), ProximaCal: d(254) },
      { ID: 'MLT-0010', Descricao: 'Multímetro de bancada', Fabricante: 'Keysight', Modelo: '34461A',
        NumSerie: 'KS-60014', Localizacao: 'Manutenção elétrica', Responsavel: 'Ricardo Mendes',
        Status: 'Ativo', Grandeza: 'Elétrica', Unidade: 'V', FaixaMin: 0, FaixaMax: 750,
        Resolucao: 0.001, Classe: '±0,0035 %', Saida: 'Digital / LAN', IntervaloMeses: 12,
        UltimaCal: d(-40), ProximaCal: d(325) },
      { ID: 'LXM-0030', Descricao: 'Luxímetro digital', Fabricante: 'Instrutherm', Modelo: 'LD-240',
        NumSerie: 'IN-8812', Localizacao: 'Qualidade — laboratório', Responsavel: 'Ana Souza',
        Status: 'Em calibração', Grandeza: 'Fotométrica', Unidade: 'lx', FaixaMin: 0, FaixaMax: 100000,
        Resolucao: 1, Classe: '±4 %', Saida: 'Display', IntervaloMeses: 6,
        UltimaCal: d(-58), ProximaCal: d(122) },
      { ID: 'FLU-0050', Descricao: 'Medidor de vazão eletromagnético', Fabricante: 'Krohne', Modelo: 'OPTIFLUX 2050',
        NumSerie: 'KR-2205', Localizacao: 'Utilidades', Responsavel: 'Letícia Prado',
        Status: 'Ativo', Grandeza: 'Vazão', Unidade: 'L/min', FaixaMin: 0, FaixaMax: 500,
        Resolucao: 0.1, Classe: '±0,5 %', Saida: '4–20 mA', IntervaloMeses: 12,
        UltimaCal: d(-60), ProximaCal: d(305) },
      { ID: 'HIG-0060', Descricao: 'Termo-higrômetro', Fabricante: 'Testo', Modelo: '608-H2',
        NumSerie: 'TS-1102', Localizacao: 'Metrologia — Sala 02', Responsavel: 'Ana Souza',
        Status: 'Ativo', Grandeza: 'Temperatura', Unidade: '°C', FaixaMin: -10, FaixaMax: 70,
        Resolucao: 0.1, Classe: '±0,5 °C', Saida: 'Display', IntervaloMeses: 6,
        UltimaCal: d(-30), ProximaCal: d(150) }
    );

    /* --- padrões e hierarquia --------------------------------------------------- */
    out.padroes.push(
      { ID: 'PB-112', Descricao: 'Jogo de blocos padrão (0,5–150 mm)', Tipo: 'Trabalho',
        Grandeza: 'Dimensional', Unidade: 'mm', Faixa: '0,5–150', Certificado: 'CT-2201/2025',
        Laboratorio: 'Lab. Metrologia (interno)', DataCal: d(-250), Validade: d(115),
        Incerteza: 0.002, Status: 'Reprovado', PadraoSuperior: 'PR-007',
        Obs: 'Reprovado na verificação intermediária: bloco de 100 mm fora da tolerância.' },
      { ID: 'PR-007', Descricao: 'Blocos padrão de referência classe K', Tipo: 'Referência',
        Grandeza: 'Dimensional', Unidade: 'mm', Faixa: '0,5–150', Certificado: '2201/2024',
        Laboratorio: 'RBC 0312 — Rede Inmetro', DataCal: d(-620), Validade: d(15),
        Incerteza: 0.0005, Status: 'Ativo', PadraoSuperior: null },
      { ID: 'PM-050', Descricao: 'Jogo de massas padrão E2 (1 mg–500 g)', Tipo: 'Trabalho',
        Grandeza: 'Massa', Unidade: 'g', Faixa: '0–500', Certificado: 'CT-1180/2026',
        Laboratorio: 'RBC 0456 — Rede Inmetro', DataCal: d(-100), Validade: d(265),
        Incerteza: 0.0002, Status: 'Ativo', PadraoSuperior: null },
      { ID: 'TP-300', Descricao: 'Termômetro padrão Pt-100', Tipo: 'Trabalho',
        Grandeza: 'Temperatura', Unidade: '°C', Faixa: '−50–300', Certificado: 'CT-0927/2026',
        Laboratorio: 'RBC 0312 — Rede Inmetro', DataCal: d(-60), Validade: d(305),
        Incerteza: 0.03, Status: 'Ativo', PadraoSuperior: null },
      { ID: 'PP-010', Descricao: 'Calibrador de pressão 0–700 bar', Tipo: 'Trabalho',
        Grandeza: 'Pressão', Unidade: 'bar', Faixa: '0–700', Certificado: 'CT-0551/2026',
        Laboratorio: 'RBC 0789 — Rede Inmetro', DataCal: d(-150), Validade: d(215),
        Incerteza: 0.05, Status: 'Ativo', PadraoSuperior: null },
      { ID: 'TT-015', Descricao: 'Transdutor de torque padrão', Tipo: 'Trabalho',
        Grandeza: 'Torque', Unidade: 'N·m', Faixa: '1–100', Certificado: 'CT-0412/2026',
        Laboratorio: 'RBC 0312 — Rede Inmetro', DataCal: d(-200), Validade: d(165),
        Incerteza: 0.1, Status: 'Ativo', PadraoSuperior: null },
      { ID: 'PE-087', Descricao: 'Calibrador multifunção (elétrica)', Tipo: 'Trabalho',
        Grandeza: 'Elétrica', Unidade: 'V', Faixa: '0–1000', Certificado: 'CT-0330/2026',
        Laboratorio: 'RBC 0456 — Rede Inmetro', DataCal: d(-120), Validade: d(245),
        Incerteza: 0.5, Status: 'Ativo', PadraoSuperior: null }
    );

    /* --- aplicações --------------------------------------------------------------- */
    out.aplicacoes.push(
      { ID: 'AP-01', Descricao: 'Diâmetro do eixo ø25 ±0,05 mm', Grandeza: 'Dimensional',
        Unidade: 'mm', FaixaMin: 0, FaixaMax: 30, EMA: 0.016, Regra: 'guarda',
        Obs: 'Característica crítica — eixo do redutor.' },
      { ID: 'AP-02', Descricao: 'Comprimento do corpo 120 ±0,5 mm', Grandeza: 'Dimensional',
        Unidade: 'mm', FaixaMin: 0, FaixaMax: 150, EMA: 0.16, Regra: 'guarda' },
      { ID: 'AP-03', Descricao: 'Temperatura do forno 180 ±5 °C', Grandeza: 'Temperatura',
        Unidade: '°C', FaixaMin: 0, FaixaMax: 300, EMA: 1.6, Regra: 'simples' },
      { ID: 'AP-04', Descricao: 'Pressão da linha 12 ±0,8 bar', Grandeza: 'Pressão',
        Unidade: 'bar', FaixaMin: 0, FaixaMax: 250, EMA: 0.26, Regra: 'guarda' },
      { ID: 'AP-05', Descricao: 'Torque de aperto M12 45 ±5 N·m', Grandeza: 'Torque',
        Unidade: 'N·m', FaixaMin: 5, FaixaMax: 50, EMA: 1.6, Regra: 'tur' },
      { ID: 'AP-06', Descricao: 'Massa de reagente 50 ±0,05 g', Grandeza: 'Massa',
        Unidade: 'g', FaixaMin: 0, FaixaMax: 100, EMA: 0.016, Regra: 'guarda' },
      { ID: 'AP-07', Descricao: 'Tensão do barramento 380 ±5 V', Grandeza: 'Elétrica',
        Unidade: 'V', FaixaMin: 0, FaixaMax: 750, EMA: 1.6, Regra: 'simples' },
      { ID: 'AP-08', Descricao: 'Vazão da linha de utilidades 200 ±10 L/min', Grandeza: 'Vazão',
        Unidade: 'L/min', FaixaMin: 0, FaixaMax: 500, EMA: 3.3, Regra: 'guarda' }
    );

    /* --- vínculos instrumento × aplicação -------------------------------------------- */
    out.vinculos.push(
      { ID: 'V-01', Instrumento: 'PQT-0142', Aplicacao: 'AP-01', Ativo: 1 },
      { ID: 'V-02', Instrumento: 'PQT-0142', Aplicacao: 'AP-02', Ativo: 1 },
      { ID: 'V-03', Instrumento: 'MIC-0073', Aplicacao: 'AP-01', Ativo: 1 },
      { ID: 'V-04', Instrumento: 'MIC-0073', Aplicacao: 'AP-02', Ativo: 1 },
      { ID: 'V-05', Instrumento: 'TRM-0087', Aplicacao: 'AP-03', Ativo: 1 },
      { ID: 'V-06', Instrumento: 'MAN-0031', Aplicacao: 'AP-04', Ativo: 1 },
      { ID: 'V-07', Instrumento: 'TRQ-0012', Aplicacao: 'AP-05', Ativo: 1 },
      { ID: 'V-08', Instrumento: 'BAL-0012', Aplicacao: 'AP-06', Ativo: 1 },
      { ID: 'V-09', Instrumento: 'MLT-0010', Aplicacao: 'AP-07', Ativo: 1 },
      { ID: 'V-10', Instrumento: 'MMV-0009', Aplicacao: 'AP-07', Ativo: 1 },
      { ID: 'V-11', Instrumento: 'FLU-0050', Aplicacao: 'AP-08', Ativo: 1 },
      { ID: 'V-12', Instrumento: 'TTM-0201', Aplicacao: 'AP-03', Ativo: 1 },
      { ID: 'V-13', Instrumento: 'MAN-0044', Aplicacao: 'AP-04', Ativo: 1 },
      { ID: 'V-14', Instrumento: 'PAQ-0202', Aplicacao: 'AP-02', Ativo: 1 },
      { ID: 'V-15', Instrumento: 'TRQ-0021', Aplicacao: 'AP-05', Ativo: 1 }
    );

    /* --- calibrações ------------------------------------------------------------------ */

    // PQT-0142 — histórico anual com deriva no ponto de 150 mm
    const pqtErros = [
      { seq: 174, off: -1504, erros: [0.001, 0.002, 0.003, 0.002, 0.004], us: [0.004, 0.004, 0.004, 0.004, 0.004], res: 'Aprovado', t: 20.8, ur: 48 },
      { seq: 288, off: -1134, erros: [0.001, 0.002, 0.004, 0.003, 0.006], us: [0.004, 0.004, 0.004, 0.005, 0.004], res: 'Aprovado', t: 21.5, ur: 50 },
      { seq: 401, off: -766,  erros: [0.002, 0.003, 0.005, 0.004, 0.008], us: [0.004, 0.005, 0.005, 0.005, 0.005], res: 'Aprovado', t: 20.9, ur: 46 },
      { seq: 512, off: -401,  erros: [0.002, 0.003, 0.006, 0.005, 0.009], us: [0.004, 0.005, 0.005, 0.005, 0.005], res: 'Aprovado', t: 21.1, ur: 49 },
      { seq: 871, off: -33,   erros: [0.004, 0.008, 0.014, 0.011, 0.021], us: [0.004, 0.005, 0.005, 0.006, 0.006], res: 'Aprovado c/ restrição', t: 20.3, ur: 52,
        obs: 'Não atende AP-01 nos pontos de 75, 100 e 150 mm. Atende AP-02 em toda a faixa.' }
    ];
    pqtErros.forEach(c => mkCal({
      inst: 'PQT-0142', off: c.off, seq: c.seq, res: c.res, metro: 'Ricardo Mendes',
      proc: 'PROC-DIM-004 rev.3', temp: c.t, um: c.ur, padrao: 'PB-112',
      nominais: [25, 50, 75, 100, 150], erros: c.erros, us: c.us, rep: 0.001,
      hora: '14:20', obs: c.obs
    }, out));

    // MIC-0073
    mkCal({ inst: 'MIC-0073', off: -381, seq: 490, res: 'Aprovado', metro: 'Ricardo Mendes',
      proc: 'PROC-DIM-002 rev.1', temp: 20.6, um: 47, padrao: 'PB-112',
      nominais: [6.25, 12.5, 18.75, 25], erros: [0.002, 0.004, 0.006, 0.008], us: [0.004, 0.004, 0.004, 0.004], rep: 0.001 }, out);

    // TRM-0087
    mkCal({ inst: 'TRM-0087', off: -349, seq: 660, res: 'Aprovado', metro: 'Letícia Prado',
      proc: 'PROC-TEM-001 rev.2', temp: 22.1, um: 44, padrao: 'TP-300', regra: 'simples',
      nominais: [0, 100, 200, 300], erros: [0.1, 0.4, 0.7, 1.1], us: [0.3, 0.3, 0.4, 0.4], rep: 0.05, hora: '11:05' }, out);

    // MAN-0031 (atual + anterior)
    mkCal({ inst: 'MAN-0031', off: -220, seq: 118, res: 'Aprovado', metro: 'Carlos Nunes',
      proc: 'PROC-PRE-003 rev.1', temp: 21.8, um: 51, padrao: 'PP-010',
      nominais: [0, 62.5, 125, 187.5, 250], erros: [0.02, 0.08, 0.15, 0.12, 0.19], us: [0.06, 0.06, 0.06, 0.07, 0.07], rep: 0.02, hora: '16:40' }, out);
    mkCal({ inst: 'MAN-0031', off: -585, seq: 41, res: 'Aprovado', metro: 'Carlos Nunes',
      proc: 'PROC-PRE-003 rev.1', temp: 21.5, um: 49, padrao: 'PP-010',
      nominais: [0, 62.5, 125, 187.5, 250], erros: [0.02, 0.07, 0.13, 0.11, 0.17], us: [0.06, 0.06, 0.06, 0.07, 0.07], rep: 0.02 }, out);

    // BAL-0005 — reprovada (atual) e aprovada (ano anterior)
    mkCal({ inst: 'BAL-0005', off: -359, seq: 620, res: 'Reprovado', metro: 'Carlos Nunes',
      proc: 'PROC-MAS-001 rev.4', temp: 21.2, um: 45, padrao: 'PM-050', regra: 'simples',
      nominais: [0, 100, 300, 500, 620], erros: [0, 0.2, 0.5, 0.9, 1.2], us: [0.1, 0.1, 0.1, 0.1, 0.1], rep: 0.01,
      hora: '09:15', obs: 'Erro além da classe de exatidão (±0,5 g) nos pontos de 500 e 620 g. Instrumento bloqueado.' }, out);
    mkCal({ inst: 'BAL-0005', off: -720, seq: 12, res: 'Aprovado', metro: 'Carlos Nunes',
      proc: 'PROC-MAS-001 rev.4', temp: 21.0, um: 44, padrao: 'PM-050', regra: 'simples',
      nominais: [0, 100, 300, 500, 620], erros: [0, 0.1, 0.2, 0.3, 0.4], us: [0.1, 0.1, 0.1, 0.1, 0.1], rep: 0.01 }, out);

    // TRQ-0012 (atual recente + anterior)
    mkCal({ inst: 'TRQ-0012', off: -2, seq: 1001, res: 'Aprovado', metro: 'Carlos Nunes',
      proc: 'PROC-TOR-002 rev.1', temp: 21.4, um: 50, padrao: 'TT-015', regra: 'tur',
      nominais: [5, 16, 28, 39, 50], erros: [0.1, 0.4, 0.7, 0.9, 1.2], us: [0.4, 0.4, 0.4, 0.5, 0.5], rep: 0.05, hora: '15:55' }, out);
    mkCal({ inst: 'TRQ-0012', off: -373, seq: 610, res: 'Aprovado', metro: 'Carlos Nunes',
      proc: 'PROC-TOR-002 rev.1', temp: 21.6, um: 48, padrao: 'TT-015', regra: 'tur',
      nominais: [5, 16, 28, 39, 50], erros: [0.1, 0.3, 0.6, 0.8, 1.0], us: [0.4, 0.4, 0.4, 0.5, 0.5], rep: 0.05 }, out);

    // MMV-0009 (atual + anterior)
    mkCal({ inst: 'MMV-0009', off: -105, seq: 918, res: 'Aprovado', metro: 'Ricardo Mendes',
      proc: 'PROC-ELE-005 rev.2', temp: 22.4, um: 43, padrao: 'PE-087', regra: 'simples',
      nominais: [0, 250, 500, 750, 1000], erros: [0.2, 0.8, 1.4, 2.1, 2.8], us: [0.8, 0.8, 0.9, 0.9, 1.0], rep: 0.1, hora: '10:10' }, out);
    mkCal({ inst: 'MMV-0009', off: -470, seq: 350, res: 'Aprovado', metro: 'Ricardo Mendes',
      proc: 'PROC-ELE-005 rev.2', temp: 22.0, um: 45, padrao: 'PE-087', regra: 'simples',
      nominais: [0, 250, 500, 750, 1000], erros: [0.1, 0.7, 1.2, 1.9, 2.5], us: [0.8, 0.8, 0.9, 0.9, 1.0], rep: 0.1 }, out);

    // LXM-0021 — externa (atual + anterior)
    mkCal({ inst: 'LXM-0021', off: -186, seq: 199, res: 'Aprovado', metro: 'Laboratório externo',
      proc: '—', temp: 23.0, um: 50, tipo: 'Externa', regra: 'simples',
      nominais: [50000, 100000, 200000], erros: [800, 1500, 2600], us: [900, 900, 1000], rep: 100,
      hora: '09:00', obs: 'Certificado externo CERT-4455 (RBC 0621).' }, out);
    mkCal({ inst: 'LXM-0021', off: -551, seq: 60, res: 'Aprovado', metro: 'Laboratório externo',
      proc: '—', temp: 23.0, um: 50, tipo: 'Externa', regra: 'simples',
      nominais: [50000, 100000, 200000], erros: [600, 1200, 2100], us: [900, 900, 1000], rep: 100,
      obs: 'Certificado externo CERT-3981 (RBC 0621).' }, out);

    // PAQ-0202
    mkCal({ inst: 'PAQ-0202', off: -168, seq: 905, res: 'Aprovado', metro: 'Carlos Nunes',
      proc: 'PROC-DIM-001 rev.2', temp: 21.2, um: 47, padrao: 'PB-112',
      nominais: [50, 100, 150, 200], erros: [0.01, 0.02, 0.02, 0.03], us: [0.01, 0.01, 0.02, 0.02], rep: 0.01 }, out);
    mkCal({ inst: 'PAQ-0202', off: -66, seq: 928, res: 'Aprovado', metro: 'Carlos Nunes',
      proc: 'PROC-DIM-001 rev.2', temp: 21.0, um: 46, padrao: 'PB-112',
      nominais: [50, 100, 150, 200], erros: [0.01, 0.02, 0.03, 0.03], us: [0.01, 0.01, 0.02, 0.02], rep: 0.01 }, out);

    // MIC-0074 — reprovou e foi aprovado após ajuste
    mkCal({ inst: 'MIC-0074', off: -90, seq: 912, res: 'Aprovado', metro: 'Ricardo Mendes',
      proc: 'PROC-DIM-002 rev.1', temp: 20.9, um: 48, padrao: 'PB-112',
      nominais: [12.5, 25, 37.5, 50], erros: [0.001, 0.002, 0.002, 0.003], us: [0.003, 0.003, 0.003, 0.004], rep: 0.001 }, out);
    mkCal({ inst: 'MIC-0074', off: -28, seq: 940, res: 'Reprovado', metro: 'Ricardo Mendes',
      proc: 'PROC-DIM-002 rev.1', temp: 20.7, um: 49, padrao: 'PB-112', regra: 'simples',
      nominais: [12.5, 25, 37.5, 50], erros: [0.002, 0.003, 0.005, 0.012], us: [0.003, 0.003, 0.003, 0.004], rep: 0.001,
      obs: 'Erro de 0,012 mm no ponto de 50 mm — além da classe ±0,004 mm. Enviado para ajuste.' }, out);
    mkCal({ inst: 'MIC-0074', off: -25, seq: 944, res: 'Aprovado', metro: 'Ricardo Mendes',
      proc: 'PROC-DIM-002 rev.1', temp: 20.8, um: 48, padrao: 'PB-112',
      nominais: [12.5, 25, 37.5, 50], erros: [0.001, 0.001, 0.002, 0.002], us: [0.003, 0.003, 0.003, 0.004], rep: 0.001,
      obs: 'Recalibração após ajuste.' }, out);

    // TTM-0201
    mkCal({ inst: 'TTM-0201', off: -150, seq: 901, res: 'Aprovado', metro: 'Letícia Prado',
      proc: 'PROC-TEM-002 rev.1', temp: 22.3, um: 45, padrao: 'TP-300', regra: 'simples',
      nominais: [100, 200, 300, 400], erros: [0.2, 0.4, 0.7, 1.0], us: [0.3, 0.3, 0.4, 0.4], rep: 0.05 }, out);
    mkCal({ inst: 'TTM-0201', off: -45, seq: 936, res: 'Aprovado', metro: 'Letícia Prado',
      proc: 'PROC-TEM-002 rev.1', temp: 22.0, um: 46, padrao: 'TP-300', regra: 'simples',
      nominais: [100, 200, 300, 400], erros: [0.2, 0.5, 0.8, 1.1], us: [0.3, 0.3, 0.4, 0.4], rep: 0.05 }, out);

    // BAL-0012
    mkCal({ inst: 'BAL-0012', off: -125, seq: 908, res: 'Aprovado', metro: 'Carlos Nunes',
      proc: 'PROC-MAS-001 rev.4', temp: 21.1, um: 46, padrao: 'PM-050',
      nominais: [0, 50, 100, 220], erros: [0, 0.0002, 0.0004, 0.0007], us: [0.0002, 0.0002, 0.0003, 0.0003], rep: 0.0001 }, out);
    mkCal({ inst: 'BAL-0012', off: -5, seq: 1003, res: 'Aprovado', metro: 'Carlos Nunes',
      proc: 'PROC-MAS-001 rev.4', temp: 21.2, um: 45, padrao: 'PM-050',
      nominais: [0, 50, 100, 220], erros: [0, 0.0002, 0.0005, 0.0008], us: [0.0002, 0.0002, 0.0003, 0.0003], rep: 0.0001 }, out);

    // MAN-0044
    mkCal({ inst: 'MAN-0044', off: -98, seq: 915, res: 'Aprovado', metro: 'Letícia Prado',
      proc: 'PROC-PRE-003 rev.1', temp: 21.7, um: 50, padrao: 'PP-010',
      nominais: [0, 100, 200, 300, 400], erros: [0.02, 0.09, 0.14, 0.12, 0.18], us: [0.05, 0.05, 0.06, 0.06, 0.06], rep: 0.02 }, out);
    mkCal({ inst: 'MAN-0044', off: -35, seq: 947, res: 'Aprovado', metro: 'Letícia Prado',
      proc: 'PROC-PRE-003 rev.1', temp: 21.6, um: 49, padrao: 'PP-010',
      nominais: [0, 100, 200, 300, 400], erros: [0.02, 0.08, 0.15, 0.13, 0.19], us: [0.05, 0.05, 0.06, 0.06, 0.06], rep: 0.02 }, out);

    // TRQ-0021 — reprovou em junho e foi aprovado na recalibração
    mkCal({ inst: 'TRQ-0021', off: -118, seq: 920, res: 'Reprovado', metro: 'Carlos Nunes',
      proc: 'PROC-TOR-001 rev.1', temp: 21.5, um: 47, padrao: 'TT-015', regra: 'tur',
      nominais: [10, 32, 55, 77, 100], erros: [0.2, 0.9, 1.8, 2.6, 4.9], us: [0.4, 0.4, 0.5, 0.5, 0.6], rep: 0.05,
      obs: 'Erro de 4,9 N·m no ponto de 100 N·m (TUR < 4:1 na AP-05). Ajuste solicitado.' }, out);
    mkCal({ inst: 'TRQ-0021', off: -111, seq: 923, res: 'Aprovado', metro: 'Carlos Nunes',
      proc: 'PROC-TOR-001 rev.1', temp: 21.4, um: 48, padrao: 'TT-015', regra: 'tur',
      nominais: [10, 32, 55, 77, 100], erros: [0.1, 0.5, 0.9, 1.2, 1.6], us: [0.4, 0.4, 0.5, 0.5, 0.6], rep: 0.05,
      obs: 'Recalibração após ajuste do mecanismo de estalo.' }, out);

    // MLT-0010
    mkCal({ inst: 'MLT-0010', off: -135, seq: 904, res: 'Aprovado', metro: 'Ricardo Mendes',
      proc: 'PROC-ELE-001 rev.3', temp: 22.2, um: 44, padrao: 'PE-087', regra: 'simples',
      nominais: [0, 190, 375, 560, 750], erros: [0.001, 0.04, 0.09, 0.12, 0.16], us: [0.05, 0.05, 0.06, 0.06, 0.07], rep: 0.005 }, out);
    mkCal({ inst: 'MLT-0010', off: -40, seq: 945, res: 'Aprovado', metro: 'Ricardo Mendes',
      proc: 'PROC-ELE-001 rev.3', temp: 22.1, um: 45, padrao: 'PE-087', regra: 'simples',
      nominais: [0, 190, 375, 560, 750], erros: [0.001, 0.05, 0.10, 0.13, 0.17], us: [0.05, 0.05, 0.06, 0.06, 0.07], rep: 0.005 }, out);

    // LXM-0030 — externa
    mkCal({ inst: 'LXM-0030', off: -58, seq: 930, res: 'Aprovado', metro: 'Laboratório externo',
      proc: '—', temp: 23.0, um: 50, tipo: 'Externa', regra: 'simples',
      nominais: [25000, 50000, 100000], erros: [400, 900, 1700], us: [600, 600, 700], rep: 100,
      obs: 'Certificado externo CERT-4612 (RBC 0621).' }, out);

    // FLU-0050 — externa
    mkCal({ inst: 'FLU-0050', off: -160, seq: 900, res: 'Aprovado', metro: 'Laboratório externo',
      proc: '—', temp: 22.5, um: 50, tipo: 'Externa', regra: 'guarda',
      nominais: [100, 200, 350, 500], erros: [0.3, 0.8, 1.2, 1.9], us: [0.4, 0.4, 0.5, 0.5], rep: 0.1,
      obs: 'Certificado externo CERT-4520 (RBC 0456).' }, out);
    mkCal({ inst: 'FLU-0050', off: -60, seq: 929, res: 'Aprovado', metro: 'Laboratório externo',
      proc: '—', temp: 22.5, um: 50, tipo: 'Externa', regra: 'guarda',
      nominais: [100, 200, 350, 500], erros: [0.4, 0.9, 1.3, 2.0], us: [0.4, 0.4, 0.5, 0.5], rep: 0.1,
      obs: 'Certificado externo CERT-4668 (RBC 0456).' }, out);

    // HIG-0060 (intervalo 6 meses)
    mkCal({ inst: 'HIG-0060', off: -215, seq: 880, res: 'Aprovado', metro: 'Letícia Prado',
      proc: 'PROC-TEM-003 rev.1', temp: 22.0, um: 50, padrao: 'TP-300', regra: 'simples',
      nominais: [0, 25, 50, 70], erros: [0.1, 0.1, 0.2, 0.2], us: [0.2, 0.2, 0.2, 0.3], rep: 0.05 }, out);
    mkCal({ inst: 'HIG-0060', off: -30, seq: 943, res: 'Aprovado', metro: 'Letícia Prado',
      proc: 'PROC-TEM-003 rev.1', temp: 22.1, um: 51, padrao: 'TP-300', regra: 'simples',
      nominais: [0, 25, 50, 70], erros: [0.1, 0.1, 0.2, 0.3], us: [0.2, 0.2, 0.2, 0.3], rep: 0.05 }, out);

    /* --- agenda ------------------------------------------------------------------------ */
    out.agenda.push(
      { ID: 'AG-01', Instrumento: 'TRM-0087', DataPrevista: d(17), Responsavel: 'Letícia Prado', Status: 'Em calibração', Obs: 'Calibração periódica — forno 2.' },
      { ID: 'AG-02', Instrumento: 'BAL-0005', DataPrevista: d(6), Responsavel: 'Carlos Nunes', Status: 'Agendada', Obs: 'Recalibração após ajuste.' },
      { ID: 'AG-03', Instrumento: 'MMV-0009', DataPrevista: d(62), Responsavel: 'Ricardo Mendes', Status: 'Em calibração', Obs: 'Envio a laboratório externo.' },
      { ID: 'AG-04', Instrumento: 'TRQ-0012', DataPrevista: d(114), Responsavel: 'Carlos Nunes', Status: 'Agendada', Obs: 'Calibração periódica.' },
      { ID: 'AG-05', Instrumento: 'MAN-0031', DataPrevista: d(145), Responsavel: 'Letícia Prado', Status: 'Agendada', Obs: 'Calibração periódica.' },
      { ID: 'AG-06', Instrumento: 'MIC-0073', DataPrevista: d(3), Responsavel: 'Ricardo Mendes', Status: 'Agendada', Obs: 'Urgente — calibração vencida.' },
      { ID: 'AG-07', Instrumento: 'LXM-0030', DataPrevista: d(12), Responsavel: 'Ana Souza', Status: 'Em calibração', Obs: 'Envio a laboratório externo (RBC 0621).' },
      { ID: 'AG-08', Instrumento: 'HIG-0060', DataPrevista: d(150), Responsavel: 'Ana Souza', Status: 'Agendada', Obs: 'Semestral.' },
      { ID: 'AG-09', Instrumento: 'MAN-0044', DataPrevista: d(330), Responsavel: 'Letícia Prado', Status: 'Agendada', Obs: 'Calibração periódica.' },
      { ID: 'AG-10', Instrumento: 'BAL-0012', DataPrevista: d(360), Responsavel: 'Carlos Nunes', Status: 'Agendada', Obs: 'Calibração periódica.' }
    );

    /* --- ocorrências --------------------------------------------------------------------- */
    out.ocorrencias.push(
      { ID: 'OC-01', Data: d(-359), Instrumento: 'BAL-0005', Tipo: 'Reprovação',
        Descricao: 'Erro de 1,2 g no ponto de 620 g — além da classe ±0,5 g.', Responsavel: 'Carlos Nunes', Status: 'Encerrada' },
      { ID: 'OC-02', Data: d(-358), Instrumento: 'BAL-0005', Tipo: 'Bloqueio',
        Descricao: 'Instrumento bloqueado para uso até ajuste e recalibração.', Responsavel: 'Letícia Prado', Status: 'Em andamento' },
      { ID: 'OC-03', Data: d(-217), Instrumento: 'PQT-0142', Tipo: 'Manutenção',
        Descricao: 'Folga no cursor observada — verificar na próxima manutenção preventiva.', Responsavel: 'Carlos Nunes', Status: 'Aberta' },
      { ID: 'OC-04', Data: d(-2), Instrumento: 'PB-112', Tipo: 'Reprovação',
        Descricao: 'Bloco de 100 mm fora da tolerância na verificação intermediária.', Responsavel: 'Ricardo Mendes', Status: 'Aberta' },
      { ID: 'OC-05', Data: d(-33), Instrumento: 'PQT-0142', Tipo: 'Não conformidade',
        Descricao: 'Não atende AP-01 nos pontos de 75, 100 e 150 mm — uso restrito à AP-02 até ajuste.', Responsavel: 'Letícia Prado', Status: 'Em andamento' },
      { ID: 'OC-06', Data: d(-118), Instrumento: 'TRQ-0021', Tipo: 'Reprovação',
        Descricao: 'Erro de 4,9 N·m no ponto de 100 N·m — TUR insuficiente para a AP-05.', Responsavel: 'Carlos Nunes', Status: 'Encerrada' },
      { ID: 'OC-07', Data: d(-111), Instrumento: 'TRQ-0021', Tipo: 'Ação corretiva',
        Descricao: 'Ajuste do mecanismo de estalo e recalibração — aprovado.', Responsavel: 'Carlos Nunes', Status: 'Encerrada' },
      { ID: 'OC-08', Data: d(-28), Instrumento: 'MIC-0074', Tipo: 'Reprovação',
        Descricao: 'Erro de 0,012 mm no ponto de 50 mm — além da classe ±0,004 mm.', Responsavel: 'Ricardo Mendes', Status: 'Encerrada' },
      { ID: 'OC-09', Data: d(-25), Instrumento: 'MIC-0074', Tipo: 'Ajuste',
        Descricao: 'Ajuste e recalibração — aprovado em todos os pontos.', Responsavel: 'Ricardo Mendes', Status: 'Encerrada' }
    );

    /* --- trilha de auditoria --------------------------------------------------------------- */
    const audSeeds = [
      { off: -33, h: '14:20', u: 'Letícia Prado', acao: 'Assinatura', ent: 'Calibracao', det: 'Calibração do PQT-0142 assinada — Aprovado c/ restrição.' },
      { off: -359, h: '09:15', u: 'Letícia Prado', acao: 'Assinatura', ent: 'Calibracao', det: 'Calibração da BAL-0005 assinada — Reprovado.' },
      { off: -358, h: '08:40', u: 'Letícia Prado', acao: 'Bloqueio', ent: 'Instrumento', det: 'BAL-0005 bloqueada após reprovação.' },
      { off: -2, h: '16:12', u: 'Ricardo Mendes', acao: 'Reprovação', ent: 'Padrao', det: 'PB-112 reprovado na verificação intermediária.' },
      { off: -28, h: '11:32', u: 'Letícia Prado', acao: 'Assinatura', ent: 'Calibracao', det: 'Calibração do MIC-0074 assinada — Reprovado.' },
      { off: -25, h: '10:05', u: 'Letícia Prado', acao: 'Assinatura', ent: 'Calibracao', det: 'Calibração do MIC-0074 assinada — Aprovado (pós-ajuste).' },
      { off: -118, h: '15:44', u: 'Letícia Prado', acao: 'Assinatura', ent: 'Calibracao', det: 'Calibração do TRQ-0021 assinada — Reprovado.' },
      { off: -111, h: '09:20', u: 'Letícia Prado', acao: 'Assinatura', ent: 'Calibracao', det: 'Calibração do TRQ-0021 assinada — Aprovado (pós-ajuste).' },
      { off: -8, h: '15:55', u: 'Letícia Prado', acao: 'Assinatura', ent: 'Calibracao', det: 'Calibração do TRQ-0012 assinada — Aprovado.' },
      { off: -5, h: '16:40', u: 'Letícia Prado', acao: 'Assinatura', ent: 'Calibracao', det: 'Calibração da BAL-0012 assinada — Aprovado.' }
    ];
    audSeeds.forEach((a, i) => out.auditoria.push({
      ID: 'AUD-' + (i + 1), DataHora: ts(d(a.off), a.h), Usuario: a.u, Acao: a.acao,
      Entidade: a.ent, EntidadeID: '', Detalhe: a.det
    }));

    return out;
  }

  return { build: build };
})();
