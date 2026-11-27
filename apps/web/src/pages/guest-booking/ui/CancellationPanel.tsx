import { useTranslation } from 'react-i18next'
import { Alert, Button } from '@/shared/ui'
import { guestCancellationErrorKey } from '../model/guest-booking'

interface CancellationPanelProps {
  canCancel: boolean
  isCancelled: boolean
  confirming: boolean
  isPending: boolean
  isError: boolean
  error: unknown
  onStart: () => void
  onConfirm: () => void
  onKeep: () => void
}

/**
 * The explicit two-step guest write. Every decision comes from the refetched
 * detail (`canCancel`) plus local pending state, so a closed booking never
 * keeps an open confirmation panel after a refused attempt.
 */
export function CancellationPanel({
  canCancel,
  isCancelled,
  confirming,
  isPending,
  isError,
  error,
  onStart,
  onConfirm,
  onKeep,
}: CancellationPanelProps) {
  const { t } = useTranslation('guestBooking')
  if (isCancelled) return null

  return (
    <div className="flex flex-col gap-2">
      {canCancel && !confirming && (
        <Button type="button" variant="outline" onClick={onStart}>
          {t('cancelBooking')}
        </Button>
      )}
      {canCancel && confirming && (
        <div className="rounded-lg border p-3" aria-labelledby="guest-cancel-question">
          <p id="guest-cancel-question">{t('cancelQuestion')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={isPending} onClick={onConfirm}>
              {isPending ? t('cancelling') : t('confirmCancel')}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={onKeep}>
              {t('keepBooking')}
            </Button>
          </div>
        </div>
      )}
      {isError && (
        <Alert variant="destructive">
          <p>{t(guestCancellationErrorKey(error))}</p>
        </Alert>
      )}
    </div>
  )
}
