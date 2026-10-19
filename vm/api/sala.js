// ============================================================
//  /api/sala  —  o "quadro compartilhado" entre projeção e celular
//  GET  /api/sala?s=1234        → { set, seq, rev, num }
//  POST /api/sala?s=1234  body  → { acao:'set'|'cena'|'rev'|'zerar'|'num', v }
//
//  Guarda o estado no Redis (Upstash/Vercel KV) quando as variáveis
//  de ambiente existem. Sem elas, guarda na memória da função:
//  funciona para testar, mas pode "esquecer" ao trocar de instância.
// ============================================================
// Acha as credenciais do Redis sem depender do nome exato da variavel:
// cada integracao (e cada prefixo escolhido na hora de conectar) batiza
// do seu jeito. Procuramos os nomes conhecidos e, se nao achar, qualquer
// par <algo>_URL / <algo>_TOKEN que aponte para um endpoint REST.
function credenciais() {
  const e = process.env;
  const conhecidos = [
    ['KV_REST_API_URL', 'KV_REST_API_TOKEN'],
    ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
    ['REDIS_REST_URL', 'REDIS_REST_TOKEN'],
  ];
  for (const [u, t] of conhecidos) {
    if (e[u] && e[t]) return { url: e[u], token: e[t], via: u };
  }
  for (const k of Object.keys(e)) {
    if (!/_REST(_API)?_URL$/.test(k)) continue;
    const v = e[k];
    if (!v || !/^https:\/\//.test(v)) continue;
    const t = k.replace(/_URL$/, '_TOKEN');
    if (e[t]) return { url: v, token: e[t], via: k };
  }
  return { url: '', token: '', via: null };
}
const KV = credenciais();
const VALIDADE = 60 * 60 * 8;          // 8 h e a sala expira sozinha
const MEM = (globalThis.__salas ||= new Map());

async function redis(cmd) {
  const r = await fetch(KV.url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + KV.token, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error('kv ' + r.status);
  return (await r.json()).result;
}
const vazio = () => ({ set: {}, seq: 0, rev: 0, num: {}, cena: 0 });

async function le(sala) {
  if (!KV.url) return MEM.get(sala) || vazio();
  const v = await redis(['GET', 'sala:' + sala]);
  return v ? JSON.parse(v) : vazio();
}
async function grava(sala, e) {
  if (!KV.url) { MEM.set(sala, e); return; }
  await redis(['SET', 'sala:' + sala, JSON.stringify(e), 'EX', String(VALIDADE)]);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const sala = String((req.query && req.query.s) || 'aula').replace(/[^0-9A-Za-z-]/g, '').slice(0, 12) || 'aula';
  try {
    if (req.method === 'GET') {
      const e = await le(sala);
      return res.status(200).json({ set: e.set, seq: e.seq, rev: e.rev, num: e.num, cena: e.cena || 0, kv: !!KV.url, via: KV.via });
    }
    if (req.method === 'POST') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const e = await le(sala);
      switch (b.acao) {
        case 'set':   Object.assign(e.set, b.v || {}); break;
        case 'cena':  e.set = Object.assign({}, b.v || {}); e.cena = (e.cena || 0) + 1; break;
        case 'rev':   e.rev = e.rev ? 0 : 1; break;
        case 'zerar': e.set = {}; e.rev = 0; e.cena = (e.cena || 0) + 1; break;
        case 'num':   e.num = b.v || {}; await grava(sala, e); return res.status(200).json({ ok: true });
        default:      return res.status(400).json({ ok: false, motivo: 'acao' });
      }
      e.seq = (e.seq || 0) + 1;
      await grava(sala, e);
      return res.status(200).json({ ok: true, seq: e.seq });
    }
    return res.status(405).json({ ok: false });
  } catch (err) {
    return res.status(500).json({ ok: false, erro: String(err) });
  }
}
