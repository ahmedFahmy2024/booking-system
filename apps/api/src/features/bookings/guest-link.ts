import { webUrl } from '../../auth.js'
import { guestLinkUrl } from '../guest/credentials.js'
import { sendMail } from '../mail/index.js'

/**
 * The private credential is only ever placed in this email. A delivery failure
 * leaves the booking and its stored link intact so staff can resend it.
 */
export async function sendGuestLink(to: string, reference: string, credential: string): Promise<void> {
  try {
    await sendMail({
      to,
      subject: 'رابط حجزك الخاص',
      text: `لعرض تفاصيل حجزك استخدم هذا الرابط الخاص: ${guestLinkUrl(webUrl, reference, credential)}`,
      kind: 'guest-link',
    })
  } catch {
    // Log only the support reference, never the credential or the link.
    console.error('Guest link email failed for booking', reference)
  }
}
