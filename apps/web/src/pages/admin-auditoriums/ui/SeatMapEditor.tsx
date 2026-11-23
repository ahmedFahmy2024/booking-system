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
  normalizeRowLabel,
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
          className="uppercase"
          aria-invalid={Boolean(rowError)}
          {...register(`rows.${rowIndex}.rowLabel`)}
        />
        {rowError && <FieldError>{t('duplicateRow')}</FieldError>}
      </Field>

      <ul
        className="flex flex-1 list-none flex-wrap gap-2 p-0"
        aria-label={t('seatsForRow', { row: normalizeRowLabel(rowLabel) })}
      >
        {seats.map((seat, seatIndex) => (
          <li
            key={seat.id}
            className="flex min-w-28 list-none flex-col gap-1 rounded-md border p-2 text-xs"
            style={{ marginInlineEnd: seat.aisleAfter ? '1rem' : undefined }}
          >
            <span className="font-semibold">
              {normalizeRowLabel(rowLabel)}
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
    formState: { errors },
  } = useFormContext<AuditoriumFormValues>()
  const {
    fields,
    append,
    remove: removeRow,
  } = useFieldArray({ control, name: 'rows' })

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
          <Button
            type="button"
            variant="outline"
            onClick={() => append(defaultRow(nextRowLabel(fields.length)))}
          >
            {t('addRow')}
          </Button>
          {errors.rows?.message && <FieldError>{t('needRow')}</FieldError>}
        </div>
      </FieldGroup>
    </FieldSet>
  )
}
