/**
 * Query-key root shared by slices that need to refresh cinema availability.
 * A guest cancellation releases seats that the showtime slice displays; without
 * a shared root the guest slice would have to import another page or duplicate a
 * literal key. Both are forbidden by the project's FSD import boundaries.
 */
export const SHOWTIME_QUERY_ROOT = 'showtime' as const
