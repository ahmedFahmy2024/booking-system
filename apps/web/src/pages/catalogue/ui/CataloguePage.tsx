import { useTranslation } from 'react-i18next'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/shared/ui'
import { useCatalogue } from '../model/useCatalogue'
import { FilmCard } from './FilmCard'

export function CataloguePage() {
  const { t } = useTranslation('catalogue')
  const { films } = useCatalogue()

  return (
    <main className="mx-auto flex max-w-[1100px] flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t('catalogueTitle')}</h1>
        <p className="text-muted-foreground">{t('catalogueDescription')}</p>
        <p className="text-muted-foreground text-sm" role="status">
          {t('filmsCount', { count: films.length })}
        </p>
      </header>
      {films.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t('catalogueTitle')}</EmptyTitle>
            <EmptyDescription>{t('noFilms')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="grid list-none gap-6 p-0 min-[701px]:grid-cols-2">
          {films.map((film) => (
            <li key={film.id}>
              <FilmCard film={film} />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
