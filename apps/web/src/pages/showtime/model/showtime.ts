export interface ShowtimeDetail {
  id: string
  filmTitle: string
  synopsis: string
  posterUrl: string | null
  durationMinutes: number
  startsAt: string
  auditoriumName: string
  pricePiastres: number
  bookingClosed: boolean
}

export interface Seat {
  id: string
  rowLabel: string
  seatNumber: number
  aisleAfter: boolean
  outOfService: boolean
  available: boolean
}

export interface SeatMap {
  showtimeId: string
  auditoriumName: string
  seats: Seat[]
}

/** The stable label comes from the auditorium data, never from screen position. */
export function seatLabel(seat: Pick<Seat, 'rowLabel' | 'seatNumber'>): string {
  return `${seat.rowLabel}${seat.seatNumber}`
}

export function seatsByRow(seats: Seat[]): Array<{ rowLabel: string; seats: Seat[] }> {
  const rows: Array<{ rowLabel: string; seats: Seat[] }> = []
  for (const seat of seats) {
    let row = rows.find((candidate) => candidate.rowLabel === seat.rowLabel)
    if (!row) {
      row = { rowLabel: seat.rowLabel, seats: [] }
      rows.push(row)
    }
    row.seats.push(seat)
  }
  return rows
}
