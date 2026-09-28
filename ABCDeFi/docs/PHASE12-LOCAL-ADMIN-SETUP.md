# Phase 12 local administrator setup

This setup is **development-only**. It is not a production credential, does not alter `.env`, and uses the ordinary administrator password and OTP flow.

The local bootstrap utility is deliberately gated by all of the following: `NODE_ENV=development`, `AUTH_MODE=development`, a localhost MongoDB URI, and `DEV_ADMIN_BOOTSTRAP=true`.

For a fresh local database, select a development-only email and a password that meets the existing password policy, then run the bootstrap utility with those values in the process environment. The browser never receives the password from source code; it is entered through the normal `/admin/login` form, followed by the normal OTP challenge.

The account is created as a persisted, active `admin` user with a bcrypt password hash and two-factor authentication enabled. On later runs, the utility verifies the supplied password against the existing hash and refuses to silently replace it. Use the separate reset utility for an intentional local password reset.

Example PowerShell shape (supply your own non-production values in the current shell only):

```powershell
$env:NODE_ENV = 'development'
$env:AUTH_MODE = 'development'
$env:MONGODB_URI = 'mongodb://127.0.0.1:27017/abcdefi'
$env:DEV_ADMIN_BOOTSTRAP = 'true'
$env:DEV_ADMIN_EMAIL = 'admin@example.test'
$env:DEV_ADMIN_PASSWORD = 'DevelopmentOnly1!'
npm run backend:ensure-admin:development
```

When the backend intentionally uses a local in-memory MongoDB instance, use that running instance's localhost URI for `MONGODB_URI` so the bootstrap process and backend address the same database. This utility never accepts a remote MongoDB URI.

Application `admin` role authorization remains separate from every module's on-chain role checks. A local application administrator does not receive unrestricted on-chain authority.
