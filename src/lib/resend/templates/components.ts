// Reusable email HTML building blocks — table-based, inline styles only.

const FONT_DISPLAY = "'Fraunces', Georgia, 'Times New Roman', serif";
const FONT_BODY = "'Outfit', Arial, Helvetica, sans-serif";

const COLOR_LIME = "#E8FF47";
const COLOR_BLACK = "#0D0D0D";
const COLOR_DARK = "#1A1A1A";
const COLOR_SURFACE = "#242424";
const COLOR_OFF_WHITE = "#F5F5F0";
const COLOR_MUTED = "#666666";
const COLOR_BORDER = "rgba(255,255,255,0.08)";

export function formatCLP(amount: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
  }).format(amount);
}

export function heading(text: string): string {
  return `<tr><td style="padding: 0 0 16px; font-family: ${FONT_DISPLAY}; font-size: 22px; font-weight: 700; color: ${COLOR_OFF_WHITE}; letter-spacing: -0.02em; line-height: 1.3;">${text}</td></tr>`;
}

export function bodyText(text: string, options?: { muted?: boolean; small?: boolean }): string {
  const color = options?.muted ? COLOR_MUTED : `rgba(245,245,240,0.75)`;
  const size = options?.small ? "13px" : "15px";
  return `<tr><td style="padding: 0 0 16px; font-family: ${FONT_BODY}; font-size: ${size}; font-weight: 300; color: ${color}; line-height: 1.65;">${text}</td></tr>`;
}

export function detailRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding: 10px 16px; border-bottom: 1px solid ${COLOR_BORDER};">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="font-family: ${FONT_BODY}; font-size: 11px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: ${COLOR_MUTED}; width: 120px; vertical-align: top; padding-top: 2px;">${label}</td>
          <td style="font-family: ${FONT_BODY}; font-size: 15px; font-weight: 300; color: ${COLOR_OFF_WHITE}; line-height: 1.5;">${value}</td>
        </tr></table>
      </td>
    </tr>`;
}

export function detailCard(rows: string): string {
  return `
    <tr><td style="padding: 0 0 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${COLOR_DARK}; border: 1px solid ${COLOR_BORDER}; border-radius: 8px;">
        ${rows}
      </table>
    </td></tr>`;
}

export function divider(): string {
  return `<tr><td style="padding: 8px 0;"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top: 1px solid ${COLOR_BORDER}; font-size: 1px; line-height: 1px;">&nbsp;</td></tr></table></td></tr>`;
}

export function statusBadge(status: string, label: string): string {
  const isPositive = status === "confirmed" || status === "completed";
  const bg = isPositive ? COLOR_LIME : COLOR_SURFACE;
  const color = isPositive ? COLOR_BLACK : COLOR_MUTED;

  return `
    <tr><td style="padding: 0 0 20px;">
      <table cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="background-color: ${bg}; border-radius: 100px; padding: 6px 16px; font-family: ${FONT_BODY}; font-size: 11px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: ${color};">${label}</td>
      </tr></table>
    </td></tr>`;
}

export function messageBlock(text: string): string {
  return `
    <tr><td style="padding: 0 0 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${COLOR_DARK}; border: 1px solid ${COLOR_BORDER}; border-radius: 8px;">
        <tr>
          <td style="width: 4px; background-color: ${COLOR_LIME}; border-radius: 8px 0 0 8px;"></td>
          <td style="padding: 16px 20px; font-family: ${FONT_BODY}; font-size: 15px; font-weight: 300; color: ${COLOR_OFF_WHITE}; line-height: 1.7;">${text}</td>
        </tr>
      </table>
    </td></tr>`;
}
