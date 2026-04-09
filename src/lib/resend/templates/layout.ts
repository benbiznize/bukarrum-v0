// Shared email layout — wraps any body content in the branded HTML shell.

export function emailLayout(
  bodyHtml: string,
  options?: { preheaderText?: string }
): string {
  const preheader = options?.preheaderText
    ? `<span style="display:none;font-size:1px;color:#0D0D0D;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${options.preheaderText}</span>`
    : "";

  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>Bukarrum</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700&family=Outfit:wght@300;500&display=swap');
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #0D0D0D; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  ${preheader}
  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #0D0D0D;">
    <tr><td align="center" style="padding: 0;">

      <!-- Inner content -->
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #0D0D0D;">

        <!-- HEADER -->
        <tr><td align="center" style="padding: 40px 24px 32px;">
          <span style="font-family: 'Fraunces', Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: 700; color: #F5F5F0; letter-spacing: -0.03em; text-decoration: none;">Bukarrum<span style="color: #E8FF47;">.</span></span>
        </td></tr>

        <!-- Divider -->
        <tr><td style="padding: 0 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top: 1px solid rgba(255,255,255,0.08); font-size: 1px; line-height: 1px;">&nbsp;</td></tr></table>
        </td></tr>

        <!-- BODY -->
        <tr><td style="padding: 32px 24px 16px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            ${bodyHtml}
          </table>
        </td></tr>

        <!-- FOOTER -->
        <tr><td style="padding: 0 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top: 1px solid rgba(255,255,255,0.08); font-size: 1px; line-height: 1px;">&nbsp;</td></tr></table>
        </td></tr>

        <tr><td align="center" style="padding: 24px 24px 16px;">
          <span style="font-family: 'Fraunces', Georgia, serif; font-size: 14px; font-weight: 700; color: rgba(245,245,240,0.25); letter-spacing: -0.03em;">Bukarrum<span style="color: rgba(232,255,71,0.3);">.</span></span>
        </td></tr>

        <tr><td align="center" style="padding: 0 24px 12px; font-family: 'Outfit', Arial, Helvetica, sans-serif; font-size: 11px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: #666666;">
          &copy; ${year} Bukarrum. Todos los derechos reservados.
        </td></tr>

        <tr><td align="center" style="padding: 0 24px 40px; font-family: 'Outfit', Arial, Helvetica, sans-serif; font-size: 12px; font-weight: 300; color: #666666; line-height: 1.6;">
          Este correo fue enviado por Bukarrum. Dudas: contacto@bukarrum.com
        </td></tr>

      </table>
      <!-- /Inner content -->

    </td></tr>
  </table>
  <!-- /Outer wrapper -->
</body>
</html>`;
}
