# language: es
Característica: REP-ANDROID-TWA-3 - AAB en CI
  Escenario: Release manual desde GitHub Actions
    Dado los secrets ANDROID_KEYSTORE_BASE64 y ANDROID_KEYSTORE_PASSWORD
    Cuando ejecuto el workflow "Android TWA"
    Entonces se publica un artifact con el AAB firmado listo para Play Console
