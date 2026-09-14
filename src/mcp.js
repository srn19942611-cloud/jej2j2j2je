/* MCP-klient til de to servere, driftshubben hviler på.
 *
 *   Enity  https://entity-love-helper.lovable.app/mcp   forbrug og produktion
 *   Dalux  https://mcp-dalux-connect.lovable.app/mcp    bygning, anlæg, opgaver
 *
 * Begge taler MCP Streamable HTTP: JSON-RPC 2.0 over POST. Serveren kan svare
 * enten med application/json eller med en text/event-stream, hvor svaret ligger
 * i en "data:"-linje — vi håndterer begge. Accept-headeren er ikke valgfri;
 * uden den svarer serveren 406.
 */

const PROTOCOL_VERSION = '2024-11-05';

export class McpClient {
  constructor(name, url, { proxy = '' } = {}) {
    this.name = name;
    this.url = url;
    this.proxy = proxy;
    this.sessionId = null;
    this.ready = null;
    this.seq = 0;
    this.status = 'ukendt';   // ukendt | forbundet | fejl
    this.error = null;
    this.tools = [];
    this.lastCall = null;
  }

  endpoint() {
    return this.proxy ? this.proxy.replace(/\/$/, '') + '/' + encodeURIComponent(this.url) : this.url;
  }

  async post(body) {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    };
    if (this.sessionId) headers['Mcp-Session-Id'] = this.sessionId;

    const res = await fetch(this.endpoint(), { method: 'POST', headers, body: JSON.stringify(body) });
    const sid = res.headers.get('Mcp-Session-Id');
    if (sid) this.sessionId = sid;

    // Notifikationer svarer 202 uden krop.
    if (res.status === 202) return null;
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} fra ${this.name}: ${text.slice(0, 300)}`);
    if (!text.trim()) return null;

    const ct = res.headers.get('content-type') || '';
    if (ct.includes('text/event-stream')) {
      // Tag den sidste data:-linje der kan parses som JSON-RPC-svar.
      let out = null;
      for (const line of text.split(/\r?\n/)) {
        if (!line.startsWith('data:')) continue;
        try {
          const obj = JSON.parse(line.slice(5).trim());
          if (obj && (obj.result !== undefined || obj.error !== undefined)) out = obj;
        } catch { /* ufuldstændig chunk — spring over */ }
      }
      return out;
    }
    return JSON.parse(text);
  }

  async rpc(method, params) {
    const msg = await this.post({ jsonrpc: '2.0', id: ++this.seq, method, params });
    if (msg && msg.error) throw new Error(`${this.name}.${method}: ${msg.error.message || JSON.stringify(msg.error)}`);
    return msg ? msg.result : null;
  }

  /** initialize + notifications/initialized. Kaldes én gang, derefter genbrugt. */
  connect() {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      try {
        await this.rpc('initialize', {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: 'coop-driftshub', version: '1.0.0' },
        });
        await this.post({ jsonrpc: '2.0', method: 'notifications/initialized' });
        const list = await this.rpc('tools/list', {});
        this.tools = (list && list.tools) || [];
        this.status = 'forbundet';
        this.error = null;
        return true;
      } catch (err) {
        this.status = 'fejl';
        this.error = describeFailure(err, this.url);
        this.ready = null;      // tillad nyt forsøg
        throw err;
      }
    })();
    return this.ready;
  }

  /** Kalder et værktøj og returnerer den fulde payload (structuredContent.data). */
  async call(tool, args = {}) {
    await this.connect();
    const started = performance.now();
    const result = await this.rpc('tools/call', { name: tool, arguments: args });
    this.lastCall = { tool, ms: Math.round(performance.now() - started), at: new Date() };

    if (result && result.isError) {
      const msg = (result.content || []).map((c) => c.text).join('\n');
      throw new Error(`${this.name}.${tool}: ${msg || 'ukendt fejl'}`);
    }
    if (result && result.structuredContent && result.structuredContent.data !== undefined) {
      return result.structuredContent.data;
    }
    const text = (result && result.content || []).map((c) => c.text).filter(Boolean).join('\n');
    try { return JSON.parse(text); } catch { return text; }
  }
}

/** Oversætter en rå fetch-fejl til noget en driftsmedarbejder kan handle på. */
function describeFailure(err, url) {
  const msg = String(err && err.message || err);
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) {
    return `Kunne ikke nå ${url}. Enten er browseren afskåret fra værten, eller serveren `
      + 'sender ikke CORS-headere til dette domæne. Sæt en proxy-URL under Opsætning, '
      + 'eller kør hubben fra et miljø med adgang.';
  }
  if (/\b406\b/.test(msg)) return 'Serveren afviste kaldet (406) — Accept-headeren mangler.';
  if (/\b40[13]\b/.test(msg)) return 'Adgang nægtet af serveren eller et mellemliggende filter.';
  return msg;
}

/* ---- De to servere ---- */

export const DEFAULTS = {
  enity: 'https://entity-love-helper.lovable.app/mcp',
  dalux: 'https://mcp-dalux-connect.lovable.app/mcp',
};

export function buildClients(cfg) {
  return {
    enity: new McpClient('Enity', cfg.enityUrl || DEFAULTS.enity, { proxy: cfg.proxy }),
    dalux: new McpClient('Dalux', cfg.daluxUrl || DEFAULTS.dalux, { proxy: cfg.proxy }),
  };
}
