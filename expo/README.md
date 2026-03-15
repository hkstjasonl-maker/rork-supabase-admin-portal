# SLP Jason Portal

## Project info

**Platform**: Native iOS & Android app, exportable to web
**Framework**: Expo Router + React Native

## Getting Started

### **Use your preferred code editor**

Clone this repo and push changes.

The only requirement is having Node.js & Bun installed - [install Node.js with nvm](https://github.com/nvm-sh/nvm) and [install Bun](https://bun.sh/docs/installation)

```bash
# Step 1: Clone the repository
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory
cd <YOUR_PROJECT_NAME>

# Step 3: Install dependencies
bun i

# Step 4: Start the web preview
bun run start-web

# Step 5: Start iOS preview
bun run start
```

## Technologies

- **React Native** - Cross-platform native mobile development framework
- **Expo** - Extension of React Native + platform
- **Expo Router** - File-based routing system
- **TypeScript** - Type-safe JavaScript
- **React Query** - Server state management
- **Supabase** - Backend and authentication
- **Lucide React Native** - Icons

## Deployment

### **Publish to App Store (iOS)**

```bash
bun i -g @expo/eas-cli
eas build:configure
eas build --platform ios
eas submit --platform ios
```

### **Publish to Google Play (Android)**

```bash
eas build --platform android
eas submit --platform android
```

## Troubleshooting

1. Clear cache: `bunx expo start --clear`
2. Reinstall: `rm -rf node_modules && bun install`
3. Check [Expo's troubleshooting guide](https://docs.expo.dev/troubleshooting/build-errors/)
