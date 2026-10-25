# language: es
Característica: REP-ANDROID-TWA-1 - Íconos PNG, manifest y Digital Asset Links
  Como ciudadano con Android
  Quiero instalar Reportalo desde Play Store
  Para usarla como cualquier otra app, sin barra de navegador

  Escenario: El manifest declara íconos que Bubblewrap acepta
    Dado el manifest web publicado en /manifest.json
    Cuando se revisa cada ícono declarado
    Entonces cada ícono es un PNG que mide lo que declara
    Y existen íconos 192 y 512 "any" y 512 "maskable"

  Escenario: Chrome verifica que la app y el sitio son del mismo dueño
    Dado el archivo /.well-known/assetlinks.json publicado en el sitio
    Cuando Chrome abre la TWA ar.com.reportalo.app
    Entonces encuentra la huella SHA-256 del certificado de la app
    Y abre la PWA a pantalla completa sin barra de URL
