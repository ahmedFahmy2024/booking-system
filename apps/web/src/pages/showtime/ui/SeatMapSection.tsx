import { MAX_BOOKING_SEATS } from '@booking-system/cinema-contracts'
import { useTranslation } from 'react-i18next'
import { cn } from '@/shared/lib'
import { seatLabel, seatsByRow } from '../model/showtime'
import { useSeatMap } from '../model/useSeatMap'

type SeatMapSectionProps = {
  showtimeId: string
  selectedSeatIds: string[]
  onToggleSeat: (seatId: string) => void
  atSeatLimit: boolean
}

export function SeatMapSection({
  showtimeId,
  selectedSeatIds,
  onToggleSeat,
  atSeatLimit,
}: SeatMapSectionProps) {
  const { t } = useTranslation('catalogue')
  const { seatMap } = useSeatMap(showtimeId)
  const rows = seatsByRow(seatMap.seats)
  const soldOut = seatMap.seats.length === 0 || seatMap.seats.every((seat) => !seat.available)
  const selected = new Set(selectedSeatIds)
  const selectedLabels = seatMap.seats
    .filter((seat) => selected.has(seat.id))
    .map(seatLabel)

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
      {atSeatLimit && (
        <p role="status" className="text-sm font-medium">
          {t('seatLimitReached', { max: MAX_BOOKING_SEATS })}
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
                  const isSelected = selected.has(seat.id)
                  return (
                    <button
                      key={seat.id}
                      type="button"
                      aria-disabled={!seat.available}
                      aria-pressed={seat.available ? isSelected : undefined}
                      aria-label={t('seatLabel', { label, state })}
                      onClick={seat.available ? () => onToggleSeat(seat.id) : undefined}
                      style={{ marginInlineEnd: seat.aisleAfter ? '1rem' : undefined }}
                      className={cn(
                        'min-w-10 rounded-md border px-2 py-1 text-xs',
                        !seat.available && 'text-muted-foreground line-through opacity-70',
                        seat.available && !isSelected && 'border-primary text-foreground',
                        seat.available && isSelected && 'border-primary bg-primary text-primary-foreground',
                      )}
                    >
                      <span aria-hidden="true">{label}</span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
          {selectedLabels.length > 0 && (
            <p role="status" className="text-sm">
              {t('selectedSeats', { seats: selectedLabels.join(t('seatListSeparator')) })}
            </p>
          )}
        </>
      )}
    </section>
  )
}
