/** Presentation helpers shared by the public cinema screens. */

/** Showtime instants are stored in UTC; the UI always presents Cairo wall time. */
export function formatCairoDateTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Cairo',
  })
}

/** Prices are stored as integer piastres and presented as EGP through Intl. */
export function formatEgp(piastres: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EGP',
  }).format(piastres / 100)
}
