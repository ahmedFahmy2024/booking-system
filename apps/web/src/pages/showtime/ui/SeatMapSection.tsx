import { useTranslation } from 'react-i18next'
import { cn } from '@/shared/lib'
import { seatLabel, seatsByRow } from '../model/showtime'
import { useSeatMap } from '../model/useSeatMap'

export function SeatMapSection({ showtimeId }: { showtimeId: string }) {
  const { t } = useTranslation('catalogue')
  const { seatMap } = useSeatMap(showtimeId)
  const rows = seatsByRow(seatMap.seats)
  const soldOut = seatMap.seats.length === 0 || seatMap.seats.every((seat) => !seat.available)

  return (
    <section aria-labelledby="seat-map-heading" className="flex flex-col gap-3">
      <div>
        <h2 id="seat-map-heading" className="text-xl font-semibold">
          {t('seatMapHeading')}
        </h2>
        <p className="text-muted-foreground text-sm">
          <bdi>{t('auditorium', { name: seatMap.auditoriumName })}</bdi>
        </p>
      </div>
      {soldOut && (
        <p role="status" className="text-sm font-medium">
          {t('allSeatsUnavailable')}
        </p>
      )}
      {rows.length > 0 && (
        <>
          <ul className="text-muted-foreground flex list-none flex-wrap gap-4 p-0 text-xs" aria-label={t('seatLegend')}>
            <li>{t('seatAvailable')}</li>
            <li className="line-through">{t('seatOutOfService')}</li>
          </ul>
          <div className="flex flex-col gap-3">
            {rows.map((row) => (
              <div
                key={row.rowLabel}
                role="group"
                aria-label={t('row', { row: row.rowLabel })}
                className="flex flex-wrap items-center gap-2"
              >
                <span aria-hidden="true" className="w-6 font-semibold">
                  {row.rowLabel}
                </span>
                {row.seats.map((seat) => {
                  const label = seatLabel(seat)
                  const state = seat.available ? t('seatAvailable') : t('seatOutOfService')
                  return (
                    <button
                      key={seat.id}
                      type="button"
                      aria-disabled={!seat.available}
                      aria-label={t('seatLabel', { label, state })}
                      style={{ marginInlineEnd: seat.aisleAfter ? '1rem' : undefined }}
                      className={cn(
                        'min-w-10 rounded-md border px-2 py-1 text-xs',
                        seat.available
                          ? 'border-primary text-foreground'
                          : 'text-muted-foreground line-through opacity-70',
                      )}
                    >
                      <span aria-hidden="true">{label}</span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
