Nexa Chat — Deployment Notes

This file contains quick steps to deploy the Nexa Chat app (Node + Postgres) to Fly.io or run locally with Postgres.

1) Build & run locally (Postgres required)

 - Install dependencies:
   ```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
   cd G:\nexaweb
   npm install
   ```

 - Create a Postgres database (local or hosted) and set DATABASE_URL. Example local environment variables in PowerShell:
   ```powershell
   $env:DATABASE_URL = "postgres://ne xa_user:nexa_pass@localhost:5432/nexa"
   $env:SESSION_SECRET = "replace-with-strong-secret"
   npm start
   ```

2) Deploy to Fly.io (keeps using Postgres)

 - Install flyctl: https://fly.io/docs/hands-on/install-flyctl/
 - Login and create app:
   ```bash
   fly launch --name nexa-chat --region iad --no-deploy
   ```
 - Create a Postgres cluster and attach it to your app:
   ```bash
   fly postgres create --name nexa-pg --region iad
   fly postgres attach --app nexa-chat nexa-pg
   ```
 - Set secrets (DATABASE_URL and SESSION_SECRET will be provided or set):
   ```bash
   fly secrets set SESSION_SECRET="your-secret"
   ```
 - Deploy:
   ```bash
   fly deploy
   ```

Notes:
 - Fly provides a `DATABASE_URL` for the attached Postgres that becomes available to your app.
 - The Dockerfile in this repo is a minimal Node image. For development you may prefer `npm install` locally and `npm run dev`.
