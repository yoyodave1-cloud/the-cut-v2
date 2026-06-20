# Setup steps — The Cut v2.0 preview

## 1. Create a new project folder on your machine
Don't put this inside your existing the-cut repo — keep it separate for now
so v1.0 stays untouched and you can compare side by side.

## 2. Open this folder in Cursor
File > Open Folder > select the unzipped the-cut-v2-preview folder.

## 3. Install dependencies
In Cursor's terminal (View > Terminal):
    npm install

## 4. Start the project
    npx expo start

A QR code will appear in the terminal.

## 5. Open it on your phone
- Install Expo Go from the App Store / Google Play if you don't have it
- Scan the QR code with your phone's camera (iOS) or directly in the Expo Go app (Android)
- The app opens live on your phone, pulling real data from your Railway backend

## 6. Make changes and see them instantly
Any edit you make to App.tsx in Cursor will hot-reload on your phone automatically.
No need to restart anything unless you change package.json.

## Notes
- This connects to: https://the-cut-production-f9f7.up.railway.app
  (your existing live backend — same data, same NewsAPI/YouTube feeds)
- If any section looks empty, it's likely that endpoint has no data yet
  (e.g. /top-shorts may be empty if the Shorts pipeline hasn't run recently)
  rather than a bug in this preview.
- Ask Claude in Cursor to adjust spacing, colours, or card order directly in
  App.tsx — it's a single file so changes are easy to make and see live.
