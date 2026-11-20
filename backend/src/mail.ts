/** Enviament de correus via Resend (si RESEND_API_KEY està configurada). */
export async function sendMail(to: string, subject: string, htmlBody: string) {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.warn(`[mail] RESEND_API_KEY no configurada; no s'envia "${subject}" a ${to}`)
    return
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.MAIL_FROM ?? 'LaColla <onboarding@resend.dev>',
      to: [to],
      subject,
      html: htmlBody,
    }),
  })
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`)
}
