# Web platform audit

Use this before replacing a frontend pattern with a native browser feature. From the repository root, scan the app or the affected source directory.

```powershell
npx --yes modern-web-guidance@1.0.1 legacy-scan apps/web/src --json
```

For each relevant finding, retrieve its guide with `npx --yes modern-web-guidance@1.0.1 retrieve <guide-id>`. For a feature the scan does not cover, use the `search` command with that version. Check browser support and fallback behavior against the applicable browser targets. Keep the existing accessible name, keyboard behavior, and focus behavior when they are part of the user flow.

If a refactor is in scope, record the candidate and its browser support first. Re-scan the affected directory after the change, run the web verification command, and exercise the changed behavior in the browser. Keep the scan output with the verification evidence. [Chrome modernization workflow](https://developer.chrome.com/docs/modern-web-guidance/modernization-workflow)
