// @ts-nocheck — ren JS-implementering, ingen typer nødvendige.
/* Minimal XLSX-skriver uden afhængigheder (ESM). Bygger et gyldigt .xlsx (zip, store)
   med flere ark, inline strings, kolonnebredder og et lille sæt formater. */

export const XLSX_STIL = { TEKST: 0, FED: 1, TAL1: 2, TAL0: 3, OVERSKRIFT: 4, PCT: 5, TAL2: 6, TITEL: 7 };

function xmlEsc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}

export function kolonneNavn(n) {
  let s = '';
  n += 1;
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function celleXml(v, rIdx, cIdx) {
  const ref = kolonneNavn(cIdx) + (rIdx + 1);
  if (v == null || v === '') return '';
  let val = v, stil = 0;
  if (typeof v === 'object' && !Array.isArray(v)) { val = v.v; stil = v.s || 0; }
  if (val == null || val === '') return stil ? `<c r="${ref}" s="${stil}"/>` : '';
  if (typeof val === 'number' && isFinite(val)) return `<c r="${ref}" s="${stil}"><v>${val}</v></c>`;
  return `<c r="${ref}" s="${stil}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(val)}</t></is></c>`;
}

function arkXml(ark) {
  const cols = (ark.bredder || []).map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
  const rows = ark.raekker.map((r, ri) => {
    const celler = r.map((v, ci) => celleXml(v, ri, ci)).join('');
    return `<row r="${ri + 1}">${celler}</row>`;
  }).join('');
  const frys = ark.frysRaekke ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${ark.frysRaekke}" topLeftCell="A${ark.frysRaekke + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${frys}${cols ? `<cols>${cols}</cols>` : ''}<sheetData>${rows}</sheetData></worksheet>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="0.0"/><numFmt numFmtId="165" formatCode="0"/><numFmt numFmtId="166" formatCode="0.00"/></numFmts>
<fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E79"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFBFBFBF"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="8">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="9" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

export function byggeXlsx(ark) {
  const filer = [];
  const sheetEntries = ark.map((a, i) => ({ navn: a.navn.slice(0, 31), id: i + 1 }));
  filer.push(['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheetEntries.map((s) => `<Override PartName="/xl/worksheets/sheet${s.id}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`]);
  filer.push(['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`]);
  filer.push(['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetEntries.map((s) => `<sheet name="${xmlEsc(s.navn)}" sheetId="${s.id}" r:id="rId${s.id}"/>`).join('')}</sheets></workbook>`]);
  filer.push(['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetEntries.map((s) => `<Relationship Id="rId${s.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${s.id}.xml"/>`).join('')}<Relationship Id="rId${sheetEntries.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`]);
  filer.push(['xl/styles.xml', stylesXml()]);
  ark.forEach((a, i) => filer.push([`xl/worksheets/sheet${i + 1}.xml`, arkXml(a)]));
  return zip(filer);
}

/* --- zip (metode 0, store) --- */
const CRC_TABEL = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABEL[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function tekstTilBytes(s) {
  return new TextEncoder().encode(s);
}

function zip(filer) {
  const dele = [];
  const central = [];
  let offset = 0;
  const skriv = (arr) => { dele.push(arr); offset += arr.length; };
  const u16 = (v) => [v & 0xFF, (v >> 8) & 0xFF];
  const u32 = (v) => [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF];

  filer.forEach(([navn, indhold]) => {
    const navnBytes = tekstTilBytes(navn);
    const data = tekstTilBytes(indhold);
    const crc = crc32(data);
    const lokalOffset = offset;
    const header = [...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(navnBytes.length), ...u16(0)];
    skriv(new Uint8Array(header));
    skriv(navnBytes);
    skriv(data);
    central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(navnBytes.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(0), ...u32(lokalOffset), ...navnBytes]));
  });

  const centralStart = offset;
  central.forEach(skriv);
  const centralStr = offset - centralStart;
  skriv(new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(central.length), ...u16(central.length),
    ...u32(centralStr), ...u32(centralStart), ...u16(0)]));

  const total = dele.reduce((s, d) => s + d.length, 0);
  const ud = new Uint8Array(total);
  let p = 0;
  dele.forEach((d) => { ud.set(d, p); p += d.length; });
  return ud;
}
