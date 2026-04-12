<div align="center">

# 🚗 AI Vehicle Diagnosis & Assistance

**Smart vehicle diagnostics, roadside help & AI-powered support — all in one app**

[![Expo](https://img.shields.io/badge/Expo-54-black?style=for-the-badge&logo=expo)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React_Native-0.81-61DAFB?style=for-the-badge&logo=react)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)

[Features](#-features) •
[Quick Start](#-quick-start) •
[Tech Stack](#-tech-stack) •
[Project Structure](#-project-structure)

</div>

---

## 📱 Features

| Module | Description |
|--------|-------------|
| **🔐 Auth Flow** | Login & Register with hero imagery and floating labels |
| **🏠 Home** | Dashboard with 4 shortcut cards, quick input bar, pull-to-refresh |
| **📋 Last Activities** | Interactive list of recent diagnoses, uploads & chats |
| **📰 News & Tips** | Image slideshow with vehicle maintenance tips & updates |
| **🔧 Diagnose** | Symptom input + OBD code entry for AI-powered diagnosis |
| **📷 Camera Upload** | Vehicle image capture for visual analysis |
| **💬 AI Assistant** | Chat-style interface with message bubbles |
| **📍 Roadside Help** | Nearby mechanics map & assistance requests |
| **📞 Video Call** | Live video support with back camera, ringtone & controls |
| **📜 History** | Past diagnosis records in card layout |
| **👤 Profile** | Vehicle info, settings, account management |

---

## 🚀 Quick Start

<details>
<summary><b>Prerequisites</b></summary>

- Node.js 18+
- npm or yarn
- Expo Go app on your device
- iOS Simulator / Android Emulator (optional)

</details>

```bash
# Clone the repository
git clone https://github.com/your-username/vehicle-diagnosis-app.git
cd vehicle-diagnosis-app

# Install dependencies
npm install

# Start development server
npm start
# or
npx expo start
```

**Run on device:** Scan the QR code with Expo Go (Android) or Camera app (iOS)

```bash
# Platform-specific
npm run ios      # iOS Simulator
npm run android  # Android Emulator
```

---

## 🛠 Tech Stack

| Category | Technologies |
|----------|--------------|
| **Framework** | React Native 0.81, Expo 54 |
| **Language** | TypeScript 5.3 |
| **Navigation** | React Navigation 7 (Stack + Bottom Tabs) |
| **Media** | expo-camera, expo-audio |
| **UI** | StyleSheet, responsive hooks, Ionicons |

---

## 📁 Project Structure

```
vehicle-diagnosis-app/
├── App.tsx                 # App entry
├── app.json                # Expo config
├── assets/
│   ├── images/             # hero.gif, img1-3.gif
│   └── call.mp3            # Video call ringtone
└── src/
    ├── components/         # Card, Icon, Header, InputField, etc.
    ├── constants/          # theme.ts (colors, spacing)
    ├── hooks/              # useResponsive
    ├── navigation/         # AppNavigator (auth, tabs, stacks)
    ├── screens/            # 11 screens
    └── types/              # navigation types
```

<details>
<summary><b>Screen breakdown</b></summary>

| Screen | Purpose |
|--------|---------|
| SplashScreen | Loading with animations |
| LoginScreen / RegisterScreen | Authentication |
| HomeScreen | Dashboard, activities, slideshow |
| DiagnoseScreen | Symptom & OBD input |
| CameraUploadScreen | Image upload flow |
| ChatAssistantScreen | AI chat UI |
| AssistanceScreen | Map & mechanics |
| VideoCallScreen | Live support (camera + audio) |
| HistoryScreen | Past diagnoses |
| ProfileScreen | Account & settings |

</details>

---

## 🎨 Design System

- **Primary:** `#2563EB`
- **Background:** `#F9FAFB`
- **Cards:** White with soft shadows
- **Typography:** System fonts, responsive scaling via `useResponsive`

---

## 📄 Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start Expo dev server |
| `npm run ios` | Run on iOS |
| `npm run android` | Run on Android |
| `npm run web` | Run in browser |

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

## 📜 License

This project is private and proprietary.

---

<div align="center">

**Built with ❤️ using React Native & Expo**

</div>
