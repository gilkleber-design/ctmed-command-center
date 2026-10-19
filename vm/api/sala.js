// ============================================================
//  /api/sala  —  o "quadro compartilhado" entre projeção e celular
//  GET  /api/sala?s=1234        → { set, seq, rev, num }
//  POST /api/sala?s=1234  body  → { acao:'set'|'cena'|'rev'|'zerar'|'num', v }
//
//  Guarda o estado no Redis (Upstash/Vercel KV) quando as variáveis
//  de ambiente existem. Sem elas, guarda na memória da função:
//  funciona para testar, mas pode "esquecer" ao trocar de instância.
// ============================================================
const URL_KV   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL   || '';
const TOKEN_KV = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const VALIDADE = 60 * 60 * 8;          // 8 h e a sala expira sozinha
const MEM = (globalThis.__salas ||= new Map());

async function redis(cmd) {
  const r = await fetch(URL_KV, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN_KV, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error('kv ' + r.status);
  return (await r.json()).result;
}
const vazio = () => ({ set: {}, seq: 0, rev: 0, num: {} });

async function le(sala) {
  if (!URL_KV) return MEM.get(sala) || vazio();
  const v = await redis(['GET', 'sala:' + sala]);
  return v ? JSON.parse(v) : vazio();
}
async function grava(sala, e) {
  if (!URL_KV) { MEM.set(sala, e); return; }
  await redis(['SET', 'sala:' + sala, JSON.stringify(e), 'EX', String(VALIDADE)]);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const sala = String((req.query && req.query.s) || 'aula').replace(/[^0-9A-Za-z-]/g, '').slice(0, 12) || 'aula';
  try {
    if (req.method === 'GET') {
      const e = await le(sala);
      return res.status(200).json({ set: e.set, seq: e.seq, rev: e.rev, num: e.num, kv: !!URL_KV });
    }
    if (req.method === 'POST') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const e = await le(sala);
      switch (b.acao) {
        case 'set':   Object.assign(e.set, b.v || {}); break;
        case 'cena':  e.set = Object.assign({}, b.v || {}); break;
        case 'rev':   e.rev = e.rev ? 0 : 1; break;
        case 'zerar': e.set = {}; e.rev = 0; break;
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
