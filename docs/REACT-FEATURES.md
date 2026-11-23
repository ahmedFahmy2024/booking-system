# React feature guide

Use the table that matches the feature you are building. Choose the API that owns the behavior and check the constraint in the same row before adding a hook, wrapper, or dependency.

Baseline checked on 2026-11-23. The npm `latest` tag and the versions installed in `apps/web` are React and React DOM **19.3.1**. The web app uses Vite and `createRoot` with `StrictMode`. TanStack Router owns navigation, TanStack Query owns HTTP server state, and React Hook Form with Zod owns validated forms. The Hono API owns authorization and booking writes. [Architecture](ARCHITECTURE.md) · [Code standards](code-standards.md) · [React versions](https://react.dev/versions)

## State and composition

| Need | API or pattern | Decision |
| --- | --- | --- |
| Remember a local value | [`useState`](https://react.dev/reference/react/useState) | Keep the state with its owner. Use a functional update when the next value depends on the previous one. |
| Handle several related state transitions | [`useReducer`](https://react.dev/reference/react/useReducer) | Use a pure reducer for related UI state such as an editor with several explicit actions. Keep authoritative booking transitions in the API. |
| Calculate a value from props or state | [Calculate during render](https://react.dev/learn/you-might-not-need-an-effect) | Derive the seat count and displayed total from the selection and price. Store only the inputs. |
| Share state or reset it when the subject changes | [Lift state](https://react.dev/learn/sharing-state-between-components), [use a `key`](https://react.dev/learn/preserving-and-resetting-state) | Lift state to the closest common owner. Key an editor by record ID when switching records should also clear its draft. Preserve the same key when the draft should survive. |
| Provide a value across a subtree | [`createContext`](https://react.dev/reference/react/createContext), [`useContext`](https://react.dev/reference/react/useContext) | Use `<SomeContext value={value}>` in React 19. Start with props for nearby consumers. A new provider value updates subscribed consumers. Use Query for cached API data. |
| Read a context conditionally or read an existing Promise | [`use`](https://react.dev/reference/react/use) | `use` may appear in a condition or loop inside a component or hook. A Promise needs a stable identity, a Suspense boundary for pending state, and an error boundary for rejection. Use TanStack Query for ordinary API reads in this app. |
| Group children without an extra DOM node | [`<Fragment>`](https://react.dev/reference/react/Fragment) | Use `<>` for plain grouping and explicit `<Fragment>` when you need a `key` or `ref`. Stable 19.3 fragment refs expose group operations such as focusing, observing, or attaching listeners to child DOM elements. |
| Share stateful logic | [Custom hooks](https://react.dev/learn/reusing-logic-with-custom-hooks), [`useDebugValue`](https://react.dev/reference/react/useDebugValue) | Extract a hook for coherent behavior used by multiple consumers. Each call has its own state. Call hooks at the top level under the [Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks). Add a DevTools label when it clarifies a shared hook. |

## Rendering, navigation, and motion

| Need | API or pattern | Decision |
| --- | --- | --- |
| Keep a tab or a panel's draft when it is hidden | [`<Activity mode="hidden">`](https://react.dev/reference/react/Activity) | React hides the DOM, preserves state, and cleans up Effects. When visible, Effects run again. Render conditionally when closing should discard state. Test hide and restore, including cleanup of subscriptions or media. |
| Keep typing responsive while a result renders | [`useDeferredValue`](https://react.dev/reference/react/useDeferredValue) | Keep the input state immediate. Pass the deferred value to the expensive results UI. Deferring render does not debounce network requests. |
| Mark a non-urgent update you control | [`useTransition`](https://react.dev/reference/react/useTransition), [`startTransition`](https://react.dev/reference/react/startTransition) | Use the hook when the owner needs `isPending`. Use the standalone function when it only needs to mark updates. Keep controlled text input updates urgent. Wrap state updates after `await` in `startTransition` when they also need Transition priority. |
| Animate a React UI change | [`<ViewTransition>`](https://react.dev/reference/react/ViewTransition), [`addTransitionType`](https://react.dev/reference/react/addTransitionType) | Stable in 19.3. Use for enter, exit, update, and shared-element animation during a Transition, Suspense reveal, or deferred update. Use a matching `name` when an item moves between views. Add a Transition type inside the Transition when the action needs different motion. Verify browser fallback, reduced motion, RTL direction, and focus. Coordinate with the router's transition mechanism when animating navigation. |
| Show a loading state around a subtree | [`<Suspense>`](https://react.dev/reference/react/Suspense) | Choose the boundary at the level that can reveal together. Use it with `lazy`, a supported `use` resource, or `useSuspenseQuery`. Fetching in an Effect does not activate Suspense. Pair API errors with the existing route error and retry pattern. |
| Load component code only when needed | [`lazy`](https://react.dev/reference/react/lazy) | Declare the lazy component at module scope. Use the existing router plugin for route splitting. Consider `lazy` for a large optional component within a route. |
| Recover from a rendering error | [Error Boundary](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary) | Reuse the TanStack route error component for route failures. Use a narrower boundary for an independently recoverable section. Handle expected form or HTTP failures at their owning action or mutation. |
| Measure or reduce expensive renders | [`<Profiler>`](https://react.dev/reference/react/Profiler), [`memo`](https://react.dev/reference/react/memo), [`useMemo`](https://react.dev/reference/react/useMemo), [`useCallback`](https://react.dev/reference/react/useCallback) | Measure first. `memo` can skip child renders on unchanged props, `useMemo` caches a calculation, and `useCallback` keeps a function reference stable. Keep correctness independent of memoization. |
| Diagnose render purity and cleanup | [`<StrictMode>`](https://react.dev/reference/react/StrictMode), [`captureOwnerStack`](https://react.dev/reference/react/captureOwnerStack) | Keep the existing Strict Mode root. Development checks repeat renders, Effects, or ref callbacks to expose bugs. Owner stacks support development diagnostics. |

## Forms, Actions, and mutations

For booking and admin forms, keep the existing React Hook Form and Zod validation flow, and use a TanStack Query mutation for API writes and cache invalidation. The React Action APIs below fit a form or interaction when React owns its pending and result state. Pick one owner for those states. [Code standards](code-standards.md#web)

| Need | API or pattern | Decision |
| --- | --- | --- |
| Submit a small form with a React Action | [`<form action={fn}>`](https://react.dev/reference/react-dom/components/form), [`<button formAction={fn}>`](https://react.dev/reference/react-dom/components/form#handling-multiple-submission-types) | A function receives `FormData` in a Transition. A button's `formAction` overrides the form's `action` for that submission. `formAction` is a prop. React has no public `useFormAction` hook. |
| Show form submission status inside the form | [`useFormStatus` from `react-dom`](https://react.dev/reference/react-dom/hooks/useFormStatus) | Call it in a descendant of the form, such as its submit button. It reads the nearest parent form's `pending`, `data`, `method`, and `action`. An existing `onSubmit` flow can use its own `isSubmitting` or mutation state. |
| Render an Action's result, validation message, and pending state | [`useActionState` from `react`](https://react.dev/reference/react/useActionState) | The Action receives previous state and then the payload. Pass the dispatcher to `action` or `formAction`, or dispatch it inside `startTransition`. Dispatches for that hook queue in order. `useFormState` is the older React DOM name. |
| Preserve submitted fields after a recoverable error | [Controlled values or state-backed form defaults](https://react.dev/reference/react-dom/components/form#preserving-form-values-after-an-action) | A successfully resolved form Action resets uncontrolled fields. Returning validation errors can still resolve the Action, so preserve submitted values explicitly. Verify a failed submit and successful retry. |
| Reset an uncontrolled form from a custom Action | [`requestFormReset` from `react-dom`](https://react.dev/reference/react-dom/requestFormReset) | Use inside an Action or Transition when handling the reset yourself. A function passed directly to `<form action>` already requests a reset on success. Use React Hook Form's `reset` for a form it owns. |
| Show a temporary change while an Action is pending | [`useOptimistic`](https://react.dev/reference/react/useOptimistic) | Apply a pure updater inside an Action. Let confirmed state come from the actual result. For shared API records, use the Query cache's mutation pattern when appropriate. A selected cinema seat stays provisional until the server confirms the claim. |

## Effects, refs, and DOM integration

| Need | API or pattern | Decision |
| --- | --- | --- |
| Run work because the user clicked or submitted | [Event handler](https://react.dev/learn/separating-events-from-effects) | Start work in the handler or mutation. Derive renderable values during render. |
| Synchronize with a browser API, widget, or subscription | [`useEffect`](https://react.dev/reference/react/useEffect) | Keep dependencies complete. Clean up the work when dependencies change or the component is hidden or unmounted. |
| Read the latest props or state inside an Effect without reconnecting | [`useEffectEvent`](https://react.dev/reference/react/useEffectEvent) | Move only the logic that should stay non-reactive into an Effect Event. Call it from an Effect or another Effect Event in the same component. Keep reactivity for values that should reconnect the Effect. |
| Read browser layout before paint | [`useLayoutEffect`](https://react.dev/reference/react/useLayoutEffect) | Use for work that must happen before paint, such as measuring a positioned popover. It blocks paint. Use `useEffect` when the timing can wait. |
| Insert generated styles at the right commit phase | [`useInsertionEffect`](https://react.dev/reference/react/useInsertionEffect) | Intended for CSS-in-JS library internals. Use the repo's existing styling system for app components. |
| Store a DOM node or a mutable non-render value | [`useRef`](https://react.dev/reference/react/useRef), [ref callbacks](https://react.dev/reference/react-dom/components/common#ref-callback) | Ref updates do not trigger renders. Callback refs can return cleanup in React 19. Use a `ref` prop when forwarding access through a function component, and expose a narrow handle with [`useImperativeHandle`](https://react.dev/reference/react/useImperativeHandle) when callers only need a few commands. |
| Subscribe to a non-React store | [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore) | Use the library's own hook if it provides one. Keep `subscribe` stable and snapshot values cached until the store changes. Supply `getServerSnapshot` when using it in SSR. |
| Connect accessible labels and descriptions | [`useId`](https://react.dev/reference/react/useId) | Use for IDs such as `aria-describedby`. List keys come from stable record identity, such as a seat ID. |
| Render a popup outside an ancestor's DOM layout | [`createPortal`](https://react.dev/reference/react-dom/createPortal) | Use the shared UI component when it already manages focus and dismissal. A portal changes DOM placement while preserving React context and React event propagation. |
| Force the DOM to update for a synchronous third-party callback | [`flushSync`](https://react.dev/reference/react-dom/flushSync) | Reserve for integrations that must see the updated DOM before the callback returns. It can flush other work and show Suspense fallbacks. |

## React DOM and platform features

| Need | API or pattern | Decision |
| --- | --- | --- |
| Use browser input, focus, keyboard, or disclosure behavior | [Built-in elements](https://react.dev/reference/react-dom/components) | Start with semantic HTML and the project's accessible shared UI. Check the element's native behavior before adding custom event handling. |
| Set page metadata or link resources | [`<title>`](https://react.dev/reference/react-dom/components/title), [`<meta>`](https://react.dev/reference/react-dom/components/meta), [`<link>`](https://react.dev/reference/react-dom/components/link), [`<style>`](https://react.dev/reference/react-dom/components/style), [`<script>`](https://react.dev/reference/react-dom/components/script) | Use existing route or document ownership first. React supports metadata hoisting and special stylesheet or script handling under the documented props. Check the rendered `<head>` and keep a single active page title. |
| Start loading an asset early | [`prefetchDNS`, `preconnect`, `preload`, `preloadModule`, `preinit`, `preinitModule`](https://react.dev/reference/react-dom#resource-preloading-apis) | `prefetchDNS` resolves a host and `preconnect` opens a connection. `preload` and `preloadModule` fetch resources, while `preinit` and `preinitModule` also prepare them for use. Reuse existing Vite or browser hints and verify the effect in the network trace. |
| Mount or hydrate a React app | [`createRoot`, `hydrateRoot`](https://react.dev/reference/react-dom/client) | The current client entry uses `createRoot`. `hydrateRoot` attaches to matching server-rendered HTML. Use the root's `unmount()` when another host controls the lifecycle. |
| Integrate with Trusted Types | [React 19.3 Trusted Types support](https://react.dev/blog/2026/09/09/react-19-3#trusted-types-support) | React supports Trusted Types at applicable DOM sinks. Prefer rendering text as JSX. Where HTML insertion is required, verify the application's sanitization and policy at that boundary. |

## Server rendering and build tooling

These APIs have their own runtime or build prerequisites. The current app is a client-rendered Vite app backed by Hono over HTTP. Consider the following when a task explicitly changes that architecture. [React reference](https://react.dev/reference/react)

| Need | API or pattern | Prerequisite |
| --- | --- | --- |
| Render or stream HTML from a server | [`react-dom/server`](https://react.dev/reference/react-dom/server) | `renderToPipeableStream` and `resumeToPipeableStream` use Node streams. `renderToReadableStream` and `resume` use Web Streams. `renderToString` and `renderToStaticMarkup` are legacy non-streaming APIs. |
| Prerender or resume a prerender | [`react-dom/static`](https://react.dev/reference/react-dom/static) | `prerender` and `resumeAndPrerender` use Web Streams. `prerenderToNodeStream` and `resumeAndPrerenderToNodeStream` use Node streams. |
| Leave a browser-only subtree out of SSR | [`use(browser(reason))`](https://react.dev/reference/react-dom/browser) | Stable in 19.3. Call `browser` from `react-dom` inside `use` under a Suspense boundary. The server leaves its fallback and the browser renders the subtree. |
| Execute a component on the server or expose a Server Function | [Server Components](https://react.dev/reference/rsc/server-components), [Server Functions](https://react.dev/reference/rsc/server-functions), [`'use client'`](https://react.dev/reference/rsc/use-client), [`'use server'`](https://react.dev/reference/rsc/use-server) | Requires a compatible framework or bundler. Client Actions may call Hono through HTTP in this app. Adding a directive to a Vite SPA module does not install a server runtime. In React 19.3 an RSC can render a context provider exported by a client module. |
| Share server-render work during a request | [`cache`](https://react.dev/reference/react/cache), [`cacheSignal`](https://react.dev/reference/react/cacheSignal) | `cache` memoizes work in the React Server Component request lifecycle. `cacheSignal` provides an abort signal for the server render's cache lifetime. Continue using the Query cache for client-side API state. |
| Memoize eligible components at build time | [React Compiler](https://react.dev/learn/react-compiler), [`'use memo'`](https://react.dev/reference/react-compiler/directives/use-memo), [`'use no memo'`](https://react.dev/reference/react-compiler/directives/use-no-memo) | Requires compiler configuration in the build. The current Vite config does not enable it. The directives control compilation when it is enabled. |

## Existing code and tests

| Need | API or pattern | Decision |
| --- | --- | --- |
| Maintain class components | [`Component`](https://react.dev/reference/react/Component), [`PureComponent`](https://react.dev/reference/react/PureComponent), [`createRef`](https://react.dev/reference/react/createRef) | These remain public APIs. Follow the repository's function-component conventions for new UI and use existing route boundaries. |
| Maintain code that operates on elements directly | [`Children`](https://react.dev/reference/react/Children), [`cloneElement`](https://react.dev/reference/react/cloneElement), [`createElement`](https://react.dev/reference/react/createElement), [`isValidElement`](https://react.dev/reference/react/isValidElement), [`forwardRef`](https://react.dev/reference/react/forwardRef) | Prefer explicit JSX, props, and composition for new components. `isValidElement` checks React elements, which are a subset of renderable React nodes. React 19 function components can receive `ref` as a prop. |
| Wait for React updates in a low-level test | [`act` from `react`](https://react.dev/reference/react/act) | Use the repo's Testing Library helpers for user-facing behavior. Use `await act(...)` when a lower-level test needs to flush React work outside those helpers. |

`unstable_*` and internal exports can appear in a source checkout or npm build. Consult the official public reference and check the installed runtime and TypeScript declarations before choosing an API. [React API index](https://react.dev/reference/react) · [React 19 upgrade guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide)

## Source verification

From `apps/web`, check the current release channel and installed versions. Substitute the verified release tag in `opensrc path` when updating this guide.

```powershell
npm view react dist-tags.latest
npm ls react react-dom '@types/react' '@types/react-dom' --depth=0
$reactSource = opensrc path facebook/react@v19.3.1
rg -n 'Activity|ViewTransition|addTransitionType|useActionState|useEffectEvent' "$reactSource/packages/react/index.js"
rg -n 'browser|useFormStatus|requestFormReset' "$reactSource/packages/react-dom/index.js"
rg -n 'enableViewTransition|enableFragmentRefs' "$reactSource/packages/shared/ReactFeatureFlags.js"
```

The release source includes channel-gated exports, so cross-check the installed `react`, `react-dom`, and their type declarations. Use the public reference for documented behavior. [React 19.3.1 source](https://github.com/facebook/react/tree/v19.3.1) · [React 19.3 release notes](https://react.dev/blog/2026/09/09/react-19-3)
