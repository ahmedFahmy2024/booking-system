import {
  MAX_AUDITORIUM_SEATS,
  MAX_ROW_LABEL_LENGTH,
  normalizeRowLabel,
} from '@booking-system/cinema-contracts'
import { useTranslation } from 'react-i18next'
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import {
  Button,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  Input,
} from '@/shared/ui'
import {
  defaultRow,
  nextRowLabel,
  type AuditoriumFormValues,
} from '../model/auditorium'

function SeatRowEditor({
  rowIndex,
  removeRow,
}: {
  rowIndex: number
  removeRow: (index: number) => void
}) {
  const { t } = useTranslation('cinemaAdmin')
  const { control, register, formState } = useFormContext<AuditoriumFormValues>()
  const { fields: seats, append } = useFieldArray({
    control,
    name: `rows.${rowIndex}.seats`,
  })
  const rowLabel = useWatch({ control, name: `rows.${rowIndex}.rowLabel` }) ?? ''
  const normalizedRowLabel = normalizeRowLabel(rowLabel)
  const seatValues = useWatch({ control, name: `rows.${rowIndex}.seats` })
  const rowError = formState.errors.rows?.[rowIndex]?.rowLabel
  const seatError = formState.errors.rows?.[rowIndex]?.seats

  function addSeat() {
    const nextNumber = Math.max(0, ...seats.map((seat) => seat.seatNumber)) + 1
    append({ seatNumber: nextNumber, aisleAfter: false, isOutOfService: false })
  }

  return (
    <li className="flex flex-wrap items-start gap-3 rounded-lg border p-3">
      <Field data-invalid={Boolean(rowError)} className="w-24">
        <FieldLabel htmlFor={`row-label-${rowIndex}`}>{t('rowLabel')}</FieldLabel>
        <Input
          id={`row-label-${rowIndex}`}
          aria-invalid={Boolean(rowError)}
          {...register(`rows.${rowIndex}.rowLabel`)}
        />
        {rowError && (
          <FieldError>
            {rowError.message === 'duplicate_row'
              ? t('duplicateRow')
              : t('invalidRowLabel', { limit: MAX_ROW_LABEL_LENGTH })}
          </FieldError>
        )}
      </Field>

      <ul
        className="flex flex-1 list-none flex-wrap gap-2 p-0"
        aria-label={t('seatsForRow', { row: normalizedRowLabel })}
      >
        {seats.map((seat, seatIndex) => (
          <li
            key={seat.id}
            className="flex min-w-28 list-none flex-col gap-1 rounded-md border p-2 text-xs"
            style={{ marginInlineEnd: seatValues?.[seatIndex]?.aisleAfter ? '1rem' : undefined }}
          >
            <span className="font-semibold">
              {normalizedRowLabel}
              {seat.seatNumber}
            </span>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                className="accent-primary"
                {...register(`rows.${rowIndex}.seats.${seatIndex}.isOutOfService`)}
              />
              {t('outOfService')}
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                className="accent-primary"
                {...register(`rows.${rowIndex}.seats.${seatIndex}.aisleAfter`)}
              />
              {t('aisleAfter')}
            </label>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-1">
        <Button type="button" size="sm" variant="outline" onClick={addSeat}>
          {t('addSeat')}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => removeRow(rowIndex)}>
          {t('removeRow')}
        </Button>
      </div>
      {seatError && <FieldError>{t('duplicateSeat')}</FieldError>}
    </li>
  )
}

export function SeatMapEditor() {
  const { t } = useTranslation('cinemaAdmin')
  const {
    control,
    getValues,
    formState: { errors },
  } = useFormContext<AuditoriumFormValues>()
  const {
    fields,
    append,
    remove: removeRow,
  } = useFieldArray({ control, name: 'rows' })
  const rowsError = errors.rows?.root ?? errors.rows

  function addRow() {
    const usedLabels = new Set(getValues('rows').map((row) => normalizeRowLabel(row.rowLabel)))
    let index = 0
    let label = nextRowLabel(index)
    while (usedLabels.has(label)) {
      index += 1
      label = nextRowLabel(index)
    }
    append(defaultRow(label))
  }

  return (
    <FieldSet>
      <FieldLegend>{t('seatMap')}</FieldLegend>
      <FieldGroup>
        <ol className="flex list-none flex-col gap-3 p-0">
          {fields.map((row, rowIndex) => (
            <SeatRowEditor key={row.id} rowIndex={rowIndex} removeRow={removeRow} />
          ))}
        </ol>
        <div>
          <Button type="button" variant="outline" onClick={addRow}>
            {t('addRow')}
          </Button>
          {rowsError?.message && (
            <FieldError>
              {rowsError.message === 'seat_limit'
                ? t('seatLimit', { limit: MAX_AUDITORIUM_SEATS })
                : t('needRow')}
            </FieldError>
          )}
        </div>
      </FieldGroup>
    </FieldSet>
  )
}
