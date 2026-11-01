# Smart Campus Presence — Mobile

The React Native (Expo) mobile application source code and configuration are located in `../native`:

- **Path:** `smart_attendance/native`
- **Configuration:** `smart_attendance/native/.env` (and `mobile/.env`)
- **Main App:** `smart_attendance/native/app`

## Quick Start

```sh
cd ../native
npm install
npm start
```

For Android native build:
```sh
cd ../native
npm run android
```

The app connects to Supabase using `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

