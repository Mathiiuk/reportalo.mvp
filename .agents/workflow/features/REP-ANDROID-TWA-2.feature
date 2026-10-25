# language: es
Característica: REP-ANDROID-TWA-2 - Proyecto TWA y build firmado
  Escenario: Build local de la app Android
    Dado el JDK 17, el Android SDK y la upload key en ~/.reportalo-android
    Cuando corro "pnpm android:build"
    Entonces obtengo un AAB y un APK firmados con la huella publicada en assetlinks.json

  Escenario: Falta el keystore
    Dado que no existe la upload key
    Cuando corro "pnpm android:build"
    Entonces el script falla con un mensaje que explica cómo configurarla
