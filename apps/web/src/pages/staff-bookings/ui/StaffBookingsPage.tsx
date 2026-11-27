import { Link, useNavigate } from '@tanstack/react-router'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { formatCairoDateTime, formatEgp } from '@/shared/lib'
import {
  Badge,
  Button,
  Card,
  CardContent,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Field,
  FieldGroup,
  FieldLabel,
  Input,
  NativeSelect,
  NativeSelectOption,
  Spinner,
} from '@/shared/ui'
import { useStaffBookings, useStaffFilters } from '../model/useStaffBookings'
import type { StaffBookingsSearch } from '../model/staff-bookings'

function searchKey(search: StaffBookingsSearch) {
  return `${search.reference}|${search.filmId}|${search.showtimeId}|${search.status}|${search.period}|${search.page}|${search.pageSize}`
}

export function StaffBookingsPage({ search }: { search: StaffBookingsSearch }) {
  const { t, i18n } = useTranslation('staffBookings')
  const locale = i18n.resolvedLanguage ?? i18n.language
  const navigate = useNavigate({ from: '/staff/bookings' })
  const { data, isFetching } = useStaffBookings(search)
  const filters = useStaffFilters()

  const goTo = (patch: Partial<StaffBookingsSearch>) =>
    navigate({ search: (previous) => ({ ...previous, ...patch }) })

  const onApply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    goTo({
      reference: String(form.get('reference') ?? '').trim(),
      filmId: String(form.get('filmId') ?? ''),
      showtimeId: String(form.get('showtimeId') ?? ''),
      status: String(form.get('status') ?? 'all') as StaffBookingsSearch['status'],
      period: String(form.get('period') ?? 'upcoming') as StaffBookingsSearch['period'],
      page: 1,
    })
  }

  return (
    <main className="mx-auto flex max-w-[1100px] flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('heading')}</h1>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {t('resultsCount', { count: data.total })}
          {isFetching && (
            <span role="status" className="ms-2 inline-flex items-center gap-1">
              <Spinner aria-hidden="true" />
              {t('fetching')}
            </span>
          )}
        </p>
      </div>

      <Card>
        <CardContent>
          <form key={searchKey(search)} onSubmit={onApply} className="flex flex-col gap-4" aria-label={t('filtersHeading')}>
            <FieldGroup className="grid gap-3 min-[701px]:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="staff-reference">{t('referenceFilter')}</FieldLabel>
                <Input id="staff-reference" name="reference" defaultValue={search.reference} maxLength={120} />
              </Field>
              <Field>
                <FieldLabel htmlFor="staff-film">{t('filmFilter')}</FieldLabel>
                <NativeSelect id="staff-film" name="filmId" defaultValue={search.filmId}>
                  <NativeSelectOption value="">{t('allFilms')}</NativeSelectOption>
                  {filters.data.films.map((film) => (
                    <NativeSelectOption key={film.id} value={film.id}>
                      {film.title}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="staff-showtime">{t('showtimeFilter')}</FieldLabel>
                <NativeSelect id="staff-showtime" name="showtimeId" defaultValue={search.showtimeId}>
                  <NativeSelectOption value="">{t('allShowtimes')}</NativeSelectOption>
                  {filters.data.showtimes.map((showtime) => (
                    <NativeSelectOption key={showtime.id} value={showtime.id}>
                      {`${showtime.filmTitle} — ${formatCairoDateTime(showtime.startsAt, locale)}`}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="staff-status">{t('statusFilter')}</FieldLabel>
                <NativeSelect id="staff-status" name="status" defaultValue={search.status}>
                  <NativeSelectOption value="all">{t('statusAll')}</NativeSelectOption>
                  <NativeSelectOption value="confirmed">{t('statusConfirmed')}</NativeSelectOption>
                  <NativeSelectOption value="cancelled">{t('statusCancelled')}</NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="staff-period">{t('periodFilter')}</FieldLabel>
                <NativeSelect id="staff-period" name="period" defaultValue={search.period}>
                  <NativeSelectOption value="upcoming">{t('periodUpcoming')}</NativeSelectOption>
                  <NativeSelectOption value="all">{t('periodAll')}</NativeSelectOption>
                </NativeSelect>
              </Field>
            </FieldGroup>
            <div className="flex flex-wrap gap-2">
              <Button type="submit">{t('applyFilters')}</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  goTo({
                    reference: '',
                    filmId: '',
                    showtimeId: '',
                    status: 'all',
                    period: 'upcoming',
                    page: 1,
                  })
                }
              >
                {t('clearFilters')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {data.items.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t('heading')}</EmptyTitle>
            <EmptyDescription>{t('empty')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col gap-3" aria-label={t('heading')}>
          {data.items.map((item) => (
            <li key={item.id}>
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <Link
                      to="/staff/bookings/$bookingId"
                      params={{ bookingId: item.id }}
                      search={search}
                      className="font-medium underline underline-offset-4"
                    >
                      <bdi dir="auto">{item.filmTitle ?? item.serviceName ?? item.reference}</bdi>
                      {' — '}
                      <bdi dir="auto">{item.reference}</bdi>
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      <bdi dir="auto">{formatCairoDateTime(item.startsAt, locale)}</bdi>
                      {item.auditoriumName && (
                        <>
                          {' · '}
                          <bdi dir="auto">{item.auditoriumName}</bdi>
                        </>
                      )}
                      {item.seatCount !== null && <> · {item.seatCount} {t('seats')}</>}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {item.totalPiastres !== null && (
                      <span>{formatEgp(item.totalPiastres, locale)}</span>
                    )}
                    <Badge variant={item.status === 'cancelled' ? 'secondary' : 'default'}>
                      {item.status === 'cancelled' ? t('statusCancelled') : t('statusConfirmed')}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <nav className="flex flex-wrap items-center justify-between gap-2" aria-label={t('heading')}>
        <Button
          type="button"
          variant="outline"
          disabled={search.page <= 1}
          onClick={() => goTo({ page: search.page - 1 })}
        >
          {t('previousPage')}
        </Button>
        <span className="text-sm text-muted-foreground">
          {t('pageInfo', { page: search.page, pageCount: Math.max(data.pageCount, 1) })}
        </span>
        <Button
          type="button"
          variant="outline"
          disabled={search.page >= data.pageCount}
          onClick={() => goTo({ page: search.page + 1 })}
        >
          {t('nextPage')}
        </Button>
      </nav>
    </main>
  )
}
