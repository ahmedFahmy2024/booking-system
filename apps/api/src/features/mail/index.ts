export type MailKind = 'staff-invitation' | 'password-reset'

export interface MailMessage {
  to: string
  subject: string
  text: string
  kind: MailKind
}

export interface MailAdapter {
  send(message: MailMessage): Promise<void>
}

// Development and CI adapter. Messages stay in memory so a token is never
// written to operational logs (D8). B7.1 adds the durable Resend adapter.
const captured: MailMessage[] = []

export const localMailAdapter: MailAdapter = {
  async send(message) {
    captured.push(message)
  },
}

export function getCapturedMessages(): readonly MailMessage[] {
  return captured
}

export function clearCapturedMessages(): void {
  captured.length = 0
}

let adapter: MailAdapter = localMailAdapter

export function setMailAdapter(next: MailAdapter): void {
  adapter = next
}

export function sendMail(message: MailMessage): Promise<void> {
  return adapter.send(message)
}
