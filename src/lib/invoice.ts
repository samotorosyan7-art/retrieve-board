import type { Currency, FirmSettings } from './types';

/* One invoice document, used for both "Export PDF" (printed from the browser) and the email to the client
   (/api/notify/invoice) so they always match. Tables + inline styles only, so it renders in email clients too. */

/** A billed line. Time lines have hours × rate; amount lines (simple invoices) just an amount. */
export type InvoiceLine = { desc: string; attorney?: string; hours?: number; rate?: number; amount?: number };

export type InvoiceDoc = {
  kind: 'time' | 'amount';
  invNum: string;
  issueDate: string;      // YYYY-MM-DD
  period?: string;        // "October 2026" (time invoices)
  client: string;
  clientDetails?: string; // address / tax ID, one per line
  currency: Currency;
  lines: InvoiceLine[];
  includeVat: boolean;
  showAttorneys: boolean;
  paymentTerms: string;
  bankDetails?: string;
  note?: string;
};

export const lineAmount = (l: InvoiceLine) => (l.hours !== undefined ? l.hours * (l.rate || 0) : l.amount || 0);

export function invoiceTotals(doc: Pick<InvoiceDoc, 'lines' | 'includeVat'>, vatRate: number) {
  const sub = doc.lines.reduce((s, l) => s + lineAmount(l), 0);
  const vat = doc.includeVat ? sub * (vatRate / 100) : 0;
  return { sub, vat, total: sub + vat };
}

/** Amounts on invoices use the currency code, not a symbol: "250,000 AMD", "1,200.00 USD". */
export const invoiceMoney = (v: number, currency: Currency) =>
  (currency === 'AMD' ? Math.round(v).toLocaleString('en-US')
    : v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + ' ' + currency;

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const br = (s: string) => esc(s).replace(/\n/g, '<br>');
const fmtIssue = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

const C = { text: '#0F172A', muted: '#64748B', faint: '#94A3B8', line: '#E2E8F0', panel: '#F8FAFC', accent: '#C8A951' };
const FONT = `'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`;
const MONO = `'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace`;

/** The invoice as a full HTML page. `logoUrl` must be absolute for email. */
export function invoiceHtml(doc: InvoiceDoc, firm: FirmSettings, logoUrl: string) {
  const money = (v: number) => invoiceMoney(v, doc.currency);
  const { sub, vat, total } = invoiceTotals(doc, firm.vatRate);
  const timeCols = doc.kind === 'time';
  const attorneys = timeCols && doc.showAttorneys;

  const th = (label: string, right = false) =>
    `<th align="${right ? 'right' : 'left'}" style="padding:9px 12px;font-size:9.5px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.faint};background:${C.panel};border-bottom:1px solid ${C.line}">${label}</th>`;
  const td = (v: string, right = false, mono = false) =>
    `<td align="${right ? 'right' : 'left'}" valign="top" style="padding:10px 12px;font-size:12px;color:${C.text};border-bottom:1px solid #F1F5F9;${mono ? `font-family:${MONO};` : ''}">${v}</td>`;
  const row = (label: string, v: string, strong = false) => `
    <tr><td style="padding:6px 0;font-size:${strong ? 14 : 12}px;font-weight:${strong ? 700 : 400};color:${strong ? C.text : C.muted};${strong ? `border-top:1px solid ${C.line};padding-top:10px;` : ''}">${label}</td>
    <td align="right" style="padding:6px 0;font-size:${strong ? 14 : 12}px;font-weight:700;color:${C.text};font-family:${MONO};${strong ? `border-top:1px solid ${C.line};padding-top:10px;` : ''}">${v}</td></tr>`;

  // "Label: value" rows under the logo + company name; empty fields are left out.
  const firmRows = ([
    ['Legal name', firm.legalName], ['Address', firm.address], ['TIN', firm.tin],
    ['Phone', firm.phone], ['Email', firm.email], ['Website', firm.website],
  ] as const).filter(([, v]) => v && String(v).trim());

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Invoice ${esc(doc.invNum)} — ${esc(doc.client)}</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
<style>@page{margin:16mm}@media print{body{padding:0!important}}</style></head>
<body style="margin:0;padding:32px 16px;background:#fff;font-family:${FONT};color:${C.text}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:680px;margin:0 auto">
  <tr><td>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.panel};border:1px solid ${C.line};border-radius:12px">
      <tr>
        <td valign="top" style="padding:20px 22px">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td valign="middle" style="padding-right:10px"><img src="${esc(logoUrl)}" alt="" height="36" style="display:block;height:36px;width:auto;border:0"></td>
            <td valign="middle" style="font-size:17px;font-weight:800;letter-spacing:-0.02em;white-space:nowrap">${esc(firm.name)}</td>
          </tr></table>
          ${firmRows.length ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px">
            ${firmRows.map(([k, v]) => `<tr>
              <td valign="top" style="padding:1px 10px 1px 0;font-size:10.5px;color:${C.faint};white-space:nowrap">${k}:</td>
              <td valign="top" style="padding:1px 0;font-size:10.5px;color:${C.text}">${esc(v)}</td>
            </tr>`).join('')}
          </table>` : ''}
        </td>
        <td valign="top" align="right" style="padding:20px 22px">
          <div style="white-space:nowrap;font-size:13px;color:${C.text}">
            <span style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${C.faint}">Invoice</span>
            <span style="color:${C.faint}">&nbsp;&ndash;&nbsp;</span><span style="font-family:${MONO};font-weight:600">${esc(doc.invNum)}</span>
          </div>
          <div style="white-space:nowrap;font-size:11px;color:${C.muted};margin-top:6px">Issued &ndash; ${esc(fmtIssue(doc.issueDate))}</div>
          ${doc.period ? `<div style="white-space:nowrap;font-size:11px;color:${C.muted};margin-top:2px">Period &ndash; ${esc(doc.period)}</div>` : ''}
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;border:1px solid ${C.line};border-radius:8px">
      <tr>
        <td style="padding:12px 16px">
          <div style="font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${C.faint};margin-bottom:3px">Billed to</div>
          <div style="font-size:14px;font-weight:700">${esc(doc.client)}</div>
          ${doc.clientDetails ? `<div style="font-size:10.5px;line-height:1.7;color:${C.muted};margin-top:2px">${br(doc.clientDetails)}</div>` : ''}
        </td>
        <td align="right" style="padding:12px 16px;font-size:11px;color:${C.muted}">Payment terms<br><strong style="color:${C.text}">${esc(doc.paymentTerms)}</strong></td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;border:1px solid ${C.line};border-radius:8px;border-collapse:separate;overflow:hidden">
      <tr>${th('Description')}${attorneys ? th('Attorney') : ''}${timeCols ? th('Hours', true) + th(`Rate (${esc(doc.currency)}/hr)`, true) : ''}${th('Amount', true)}</tr>
      ${doc.lines.map(l => `<tr>${td(br(l.desc))}${attorneys ? td(esc(l.attorney || '')) : ''}${timeCols ? td(`${l.hours ?? 0}h`, true, true) + td(money(l.rate || 0), true, true) : ''}${td(money(lineAmount(l)), true, true)}</tr>`).join('')}
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right" style="width:280px;margin-top:14px">
      ${row('Subtotal', money(sub))}
      ${doc.includeVat ? row(`VAT (${firm.vatRate}%)`, money(vat)) : ''}
      ${row(`Total due${doc.includeVat ? '' : ' · excl. VAT'}`, money(total), true)}
    </table>
    <div style="clear:both;height:1px"></div>

    ${doc.note ? `<div style="margin-top:18px;padding:12px 16px;border-left:3px solid ${C.accent};background:${C.panel};font-size:12px;line-height:1.7;color:#33445E">${br(doc.note)}</div>` : ''}

    <div style="margin-top:18px;font-size:11px;line-height:1.8;color:${C.muted}">
      ${doc.bankDetails ? `<strong style="color:${C.text}">Bank transfer:</strong> ${br(doc.bankDetails)}<br>` : ''}
      ${firm.billingEmail ? `<strong style="color:${C.text}">Questions:</strong> ${esc(firm.billingEmail)}` : ''}
    </div>
  </td></tr>
</table>
</body></html>`;
}

/** Plain-text version for the email. */
export function invoiceText(doc: InvoiceDoc, firm: FirmSettings) {
  const money = (v: number) => invoiceMoney(v, doc.currency);
  const { sub, vat, total } = invoiceTotals(doc, firm.vatRate);
  const line = (l: InvoiceLine) => doc.kind === 'time'
    ? `${l.desc}${doc.showAttorneys && l.attorney ? ` — ${l.attorney}` : ''}: ${l.hours}h × ${money(l.rate || 0)} = ${money(lineAmount(l))}`
    : `${l.desc}: ${money(lineAmount(l))}`;
  return [
    `Invoice ${doc.invNum} — ${firm.legalName || firm.name}`, `Issued ${fmtIssue(doc.issueDate)}${doc.period ? ` · Period: ${doc.period}` : ''}`,
    `Billed to: ${doc.client}`, '', ...doc.lines.map(line), '',
    `Subtotal: ${money(sub)}`, ...(doc.includeVat ? [`VAT (${firm.vatRate}%): ${money(vat)}`] : []),
    `Total due${doc.includeVat ? '' : ' (excl. VAT)'}: ${money(total)}`, `Payment terms: ${doc.paymentTerms}`,
    ...(doc.note ? ['', doc.note] : []), ...(doc.bankDetails ? ['', `Bank transfer: ${doc.bankDetails}`] : []),
    ...(firm.billingEmail ? [`Questions: ${firm.billingEmail}`] : []), '', firm.name,
  ].join('\n');
}
