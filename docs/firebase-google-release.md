# Firebase + Google Cloud Release

This project is a Vite frontend plus an Express API server. A complete online
release needs both Firebase Hosting and a server runtime.

## Target Architecture

- Firebase Hosting serves the compiled `dist` frontend.
- Firebase Hosting rewrites `/api/**` to Cloud Run service `ai-wealth-master-api`.
- Cloud Run runs the existing Express server from `server.ts`.
- Firestore rules are deployed from `firestore.rules`.
- Firebase client config is supplied by `VITE_FIREBASE_*` environment variables.

## Firebase Plan Requirement

Firebase Spark can host the static frontend, but it cannot run this Express API.
For a fully working online environment, the Firebase project must be upgraded to
Blaze and linked to Cloud Billing so Cloud Run can be used. Light test traffic can
still remain inside Google Cloud free quotas, but billing must be enabled for the
backend runtime.

## One-Time Project Setup

Current release project:

```bash
PROJECT_ID="gen-lang-client-0273706712"
REGION="asia-east1"
SERVICE_ID="ai-wealth-master-api"
```

Create or select the Firebase project, then enable:

- Firebase Authentication with Google provider
- Firestore database
- Firebase Hosting
- Cloud Run
- Artifact Registry
- Cloud Build

Create a Firebase web app and copy its config into `.env.production` using
`.env.firebase.example` as the template.

## Build

```bash
npm ci
npm run build
```

## Deploy Backend

```bash
gcloud run deploy "$SERVICE_ID" \
  --source . \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production
```

Add these server env vars when available:

```bash
--set-env-vars GEMINI_API_KEY=...,OPENAI_API_KEY=...,LONGBRIDGE_APP_KEY=...,LONGBRIDGE_APP_SECRET=...,LONGBRIDGE_ACCESS_TOKEN=...
```

## Deploy Firebase Hosting And Rules

Create `.firebaserc` from `.firebaserc.example`, then deploy:

```bash
firebase deploy --only hosting,firestore:rules --project "$PROJECT_ID"
```

## Smoke Test

```bash
curl "https://$PROJECT_ID.web.app/api/health"
```

Expected response:

```json
{"status":"ok"}
```
