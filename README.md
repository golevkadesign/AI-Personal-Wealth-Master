<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/f697f91f-5f3d-49e7-a159-792bc921590d

## Backend choice

Use Firebase Spark as the free backend for Google sign-in and per-user cloud sync:

- Firebase Authentication: Google account login.
- Cloud Firestore: `userProfiles/{uid}` app state and chat history.
- Cloud Storage: large chat attachments under `chat_attachments/{uid}/...`.

Use Render's free Node web service for the Express API and the built Vite frontend. The included `render.yaml` is ready for Render Blueprint deployment.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env.local`.
3. Fill in at least one server-side AI key:
   `GEMINI_API_KEY` or `OPENAI_API_KEY`.
4. Fill in Firebase Web App values if you are not using the bundled AI Studio Firebase project:
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, and `VITE_FIREBASE_FIRESTORE_DATABASE_ID`.
5. Run the app:
   `npm run dev`

## Firebase setup

1. Create a Firebase project on the Spark plan.
2. Enable Authentication -> Sign-in method -> Google.
3. Create Firestore in Native mode.
4. Enable Cloud Storage.
5. Add your local and deployed domains in Authentication -> Settings -> Authorized domains:
   `localhost`, your Render domain such as `ai-personal-wealth-master.onrender.com`, and any custom domain.
6. Deploy rules:
   `firebase deploy --only firestore:rules,storage`

The rules in this repo restrict every user to their own `userProfiles/{uid}` document and their own attachment folder.

## Render deployment

1. Push this repo to GitHub.
2. In Render, create a new Blueprint from this repository. Render will read `render.yaml`.
3. Set these environment variables in the Render service:
   `APP_URL`, `ALLOWED_ORIGINS`, the `VITE_FIREBASE_*` values, and at least one of `GEMINI_API_KEY` or `OPENAI_API_KEY`.
4. After Render gives you the public URL, add its hostname to Firebase Authorized domains and set:
   `APP_URL=https://your-service.onrender.com`
   `ALLOWED_ORIGINS=https://your-service.onrender.com`
5. Redeploy the Render service.
