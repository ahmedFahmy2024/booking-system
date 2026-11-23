import type { ReactNode } from 'react'
import './poster-transition.css'

/**
 * Named shared element for the film poster. TanStack Router drives the native
 * View Transition on navigation (`viewTransition` on its Links); React's own
 * `<ViewTransition>` only activates for React transitions such as our Suspense
 * reveals, not for the router's external-store route commits. The CSS name is
 * therefore applied directly and scoped by film id so exactly one poster with
 * a given name is mounted at a time.
 */
export function PosterTransition({ filmId, children }: { filmId: string; children: ReactNode }) {
  return <div style={{ viewTransitionName: `poster-${filmId}` }}>{children}</div>
}
