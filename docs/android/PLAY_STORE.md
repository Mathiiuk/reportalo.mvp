# Reportalo en Google Play (Android · TWA)

La app de Android es una **Trusted Web Activity (TWA)**: un contenedor nativo que abre la PWA en Chrome, a pantalla completa y sin barra de URL. Todo lo que funciona en la PWA (Service Worker, offline, Web Push, login con Google, magic link, cámara y GPS) funciona igual, y cada deploy de la web actualiza la app sin pasar por Play. En iPhone se sigue usando la PWA instalable.

| Dato | Valor |
|---|---|
| applicationId | `ar.com.reportalo.app` (**no se puede cambiar** después de publicar) |
| Abre | `https://reportalo-staging.vercel.app/` |
| Proyecto Android | `android/twa/` (generado con Bubblewrap 1.27, se commitea) |
| Configuración | `scripts/android/generar-twa.mjs` + `public/manifest.json` |
| Digital Asset Links | `public/.well-known/assetlinks.json` |
| Ícono de la ficha | `android/store/play-store-icon-512.png` |

## Cómo funciona la verificación

Chrome abre la app sin barra de URL solo si `https://<host>/.well-known/assetlinks.json` contiene la huella SHA-256 del certificado **con el que se firmó el APK instalado**. Hay dos huellas posibles:

1. **Upload key** (nuestra): firma lo que subimos a Play y lo que instalamos a mano. Ya está en `assetlinks.json`.
2. **App signing key** (de Google): con Play App Signing, Google vuelve a firmar la app antes de distribuirla. **Hay que agregar esa huella también**; si falta, la app que se baja de Play abre con barra de URL.

## 1. Preparar la PC (una sola vez)

Hace falta JDK 17 y el Android SDK. `pnpm android:build` los busca en `JAVA_HOME` / `ANDROID_HOME` o, si no están definidos, en las rutas de abajo:

- JDK 17 (Temurin): `%LOCALAPPDATA%\Programs\Java\jdk-17.*`
- Android SDK: `%LOCALAPPDATA%\Android\Sdk` con `platform-tools`, `build-tools;36.0.0` y `platforms;android-36`

```bash
sdkmanager --sdk_root="$LOCALAPPDATA/Android/Sdk" "platform-tools" "build-tools;36.0.0" "platforms;android-36"
```

## 2. Upload key

Vive **fuera del repo**, en `%USERPROFILE%\.reportalo-android\`:

- `upload-keystore.jks`: keystore PKCS12, alias `upload`, RSA 4096, 10.000 días
- `credenciales.txt`: ruta, alias y contraseñas (`KEYSTORE=`, `ALIAS=`, `STORE_PASSWORD=`, `KEY_PASSWORD=`)

> **Hacé un backup de las dos cosas en el gestor de contraseñas del equipo.** Si se pierde la upload key se puede pedir un reseteo en Play Console, pero lleva días y frena los releases.

Para ver la huella:

```bash
keytool -list -v -keystore "$USERPROFILE/.reportalo-android/upload-keystore.jks" -alias upload
```

## 3. Compilar

```bash
pnpm android:build
```

Genera en `android/twa/dist/`:

- `app-release-bundle.aab`: el que se sube a Play Console
- `app-release-signed.apk`: para instalar a mano con `adb install` o pasándolo al teléfono

El script compila con Gradle, firma, y **falla si la huella del APK no está en `assetlinks.json`**.

### Nueva versión

Play rechaza un AAB con un `versionCode` que ya se subió. Para el próximo release:

```bash
node scripts/android/generar-twa.mjs --bump
```

```bash
pnpm android:build
```

Solo hace falta generar una nueva versión del AAB si cambia algo nativo: el nombre, los íconos, los colores, el host o los shortcuts. **Los cambios de la web no necesitan un release en Play.**

## 4. CI (GitHub Actions)

`.github/workflows/android-twa.yml` corre a mano (Actions → *Android TWA* → *Run workflow*) y en cada push a `staging`/`main` que toque `android/twa/`, `scripts/android/` o `assetlinks.json`. Sube el AAB y el APK como artifact.

Secrets necesarios (Settings → Secrets and variables → Actions):

| Secret | Valor |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | el `.jks` en base64: `base64 -w0 upload-keystore.jks` |
| `ANDROID_KEYSTORE_PASSWORD` | `STORE_PASSWORD` de `credenciales.txt` |
| `ANDROID_KEY_PASSWORD` | opcional, si es distinta de la del keystore |

## 5. Play Console (lo hace una persona)

1. **Cuenta de desarrollador** en <https://play.google.com/console> (pago único de USD 25). Conviene una cuenta de **organización** a nombre de Canopus o UNLZ: las cuentas personales nuevas tienen que pasar 14 días de prueba cerrada con 12 testers antes de publicar en producción.
2. **Crear app** → nombre *Reportalo*, idioma es-419, App, Gratis.
3. **Prueba interna** → Crear versión → aceptar **Play App Signing** → subir `app-release-bundle.aab`.
4. **Configuración → Integridad de la app → Firma de apps**: copiar la **huella SHA-256 del certificado de firma de apps** y agregarla a `public/.well-known/assetlinks.json` (al lado de la de la upload key). Deployar staging.
5. Comprobar que el archivo se sirve bien con la herramienta de Google: `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://reportalo-staging.vercel.app&relation=delegate_permission/common.handle_all_urls`
6. Completar la ficha: descripción corta y larga, ícono (`android/store/play-store-icon-512.png`), gráfico de funciones 1024x500, al menos 2 capturas de teléfono.
7. **Contenido de la app**: política de privacidad (URL pública), acceso a la app (explicar el login con Google o magic link y dar una cuenta de prueba para la revisión), anuncios: no, clasificación de contenido, público objetivo (18+), **Seguridad de los datos** (ubicación, fotos, email; cifrado en tránsito; posibilidad de pedir el borrado).
8. Agregar testers a la prueba interna y compartirles el link de opt-in.

## 6. Pasar a producción

Cuando exista el dominio de producción (`reportalo.com.ar`):

1. Cambiar `HOST` en `scripts/android/generar-twa.mjs`.
2. Publicar `/.well-known/assetlinks.json` (las dos huellas) en ese dominio.
3. `node scripts/android/generar-twa.mjs --bump` y `pnpm android:build`.
4. Subir el AAB nuevo. El `applicationId` sigue siendo el mismo.

## Problemas conocidos

- **La app abre con barra de URL**: falta la huella con la que se firmó la app instalada en `assetlinks.json`, o el archivo no está deployado en el host. Revisar el punto 5.4.
- **Ícono algo borroso**: el logo de origen mide 257x322 y se reescaló a 512. Antes de producción conviene regenerar los PNG desde el vector (`public/icons/` y `android/store/`) y correr `pnpm android:generar`.
