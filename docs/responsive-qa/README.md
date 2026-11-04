# Local responsive QA

This QA project uses only a local SQLite database, a loopback API, and a loopback
Vite server. Do not put production credentials or a remote URL in `.env.e2e`.

## One-time setup

From the repository root, install Playwright's browser if it is not already
available:

```powershell
Set-Location frontend
npx playwright install chromium
```

In a separate PowerShell terminal, seed the local database and start the API:

```powershell
Set-Location backend
$env:DATABASE_URL = "sqlite:///./e2e-responsive-qa.db"
$env:ALLOW_SQLITE_RUNTIME = "1"
$env:JWT_SECRET_KEY = "local-responsive-e2e-only-secret"
$env:ENVIRONMENT = "test"
python scripts/seed_responsive_e2e.py
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

The seed command creates one local tenant and the seven role accounts. Generated
passwords are written only to `frontend/e2e/.env.e2e`. The Playwright setup logs
in through the local Vite proxy and writes browser states to the ignored
`frontend/e2e/.auth/` directory. It refuses non-loopback HTTP URLs.

## Run the role checks

From `frontend/`, run the requested sequence from Operator through Admin:

```powershell
npx playwright test responsive-certification.spec.js
```

To run one role while iterating, use its project name, for example:

```powershell
npx playwright test responsive-certification.spec.js --project=responsive-operator
```

The test discovers that role's sidebar and mobile “More” links, captures each
discovered page at the configured viewport sizes, and checks for horizontal
page overflow, undersized touch targets, and clipped text. Images are written to
`docs/responsive-qa/<role>/<width>x<height>/<page>.png`. A role only passes when
its Playwright test passes.

The frontend test command is non-watch:

```powershell
npm test
```

## Reference image

The design reference was not present in the repository or available as a
workspace file during this run. Do not create a substitute image; place the
provided reference at `docs/design-reference/responsive-all-roles.png` before
visual sign-off.
