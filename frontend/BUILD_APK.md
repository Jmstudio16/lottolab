# LOTTOLAB PRO - Build APK Android

## Prérequis

1. **Node.js** 18+
2. **Android Studio** avec SDK 33+
3. **Java JDK** 17+

## Installation Capacitor

```bash
cd frontend

# Installer Capacitor
npm install @capacitor/core @capacitor/cli
npm install @capacitor/android @capacitor/ios

# Plugins Capacitor nécessaires
npm install @capacitor/splash-screen
npm install @capacitor/status-bar
npm install @capacitor/keyboard
npm install @capacitor/app

# Plugin Bluetooth pour impression
npm install cordova-plugin-bluetooth-serial
npm install @nicennnnnnnlee/capacitor-bluetooth-serial
```

## Build Production

```bash
# 1. Build React production
npm run build

# 2. Initialiser Capacitor (première fois seulement)
npx cap init "LOTTOLAB PRO" com.lottolab.pro --web-dir build

# 3. Ajouter Android
npx cap add android

# 4. Synchroniser
npx cap sync android

# 5. Ouvrir Android Studio
npx cap open android
```

## Build APK (Android Studio)

1. Ouvrir Android Studio
2. `Build` > `Generate Signed Bundle / APK`
3. Choisir "APK"
4. Créer ou utiliser un keystore
5. Sélectionner "release"
6. L'APK sera dans `android/app/release/`

## Build APK (Ligne de commande)

```bash
cd android

# Debug APK
./gradlew assembleDebug
# -> android/app/build/outputs/apk/debug/app-debug.apk

# Release APK
./gradlew assembleRelease
# -> android/app/build/outputs/apk/release/app-release.apk
```

## Configuration Bluetooth

Le plugin Bluetooth est configuré pour :
- Scanner les imprimantes Bluetooth
- Se connecter automatiquement
- Imprimer via ESC/POS
- Reconnexion automatique

### Permissions Android (automatiques)

```xml
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

## Mode Offline

L'application fonctionne 100% hors ligne :
- Données stockées dans IndexedDB
- Tickets créés localement
- Synchronisation automatique au retour de la connexion
- Impression Bluetooth sans serveur

## Support

- **Site**: https://lottolab.tech
- **Email**: support@lottolab.tech
