# Select a service

The booking form lists the services and their durations.

## Sub-features

- Select an available service for a new booking.

## How to get to it (user POV)

- Open `/` and find the `Service` field under `New booking`.

## Driving it with Playwright

Run `npm --prefix apps/web run test:e2e -- --trace on` from the repository root. The spec selects service ID `1` by the `Service` label. The saved booking proves the selection was accepted. For a change to the options, also check the visible name and duration against the services response.

## Gotchas

- Service ID `1` must exist in the isolated database before the run.
