# Reportalo

*Plataforma de Auditoría Ciudadana*

## V-02 — BACKUP CON DATOS REALES EN UN REPOSITORIO PÚBLICO

**Versión 1.0 · 15 de septiembre de 2026 · Construcción · Proyecto RAR-2026**

**Responde a:** `REP-2908-VERIF_ronda2_hernan.md` §3, V-02 (Hernán, 15/09)
**Jira:** [REP-2908](https://unlz2026.atlassian.net/browse/REP-2908)

**Equipo:** Hernán Gregorini (PO · DBA) · Leonel Nuñez (PM / Scrum Master) · Matías Krepchuk (Líder Técnico · UX/UI) · Iván Juárez (QA · UX/UI)

**Consultor Especialista:** Carlos Ruiz (auditor externo · asesoría metodológica)

> **Propósito.** Documentar el hallazgo de V-02 (backup real de la base en el historial de Git de un repositorio público), lo que ya se corrigió, y lo que falta — que requiere coordinación de todo el equipo antes de ejecutarse.

---

## 1. Qué se encontró

- El backup `supabase/backups/2026-09-14_pre-deploy-rag/` (44 tablas, esquema, funciones de la base) se commiteó al repositorio y **quedó mergeado en `staging`** durante el despliegue del RAG.
- **El repositorio de GitHub es público.** Verificado directamente: la página del repositorio se ve sin iniciar sesión, sin ningún error de acceso.
- Según la tabla de decisión de Hernán (§3, V-02), un backup en un repositorio público obliga a limpiar el historial de Git — **sin importar qué tan sensibles sean los datos**, por el simple hecho de ser público.

## 2. Qué datos personales tiene el backup

Solo nombres de columnas, nunca valores:

| Tabla | Columnas con datos personales | Alcance |
|---|---|---|
| `profiles` | `username` (es el email real), `full_name` | Cuentas reales del equipo (Iván, Matías, etc.) |
| `terms_consents` | `user_id`, `camera_permission`, `location_permission` | Referencia a usuario, sin dato directo |
| `agency_contacts` | `contact_value`, `contact_channel` | Teléfono/email de organismos, no de ciudadanos |
| `citizen_reports` | — | Vacía al momento del backup |

No hay datos de ciudadanos reales expuestos — son cuentas del equipo. Esto no cambia la obligación de limpiar el historial (regla del repositorio público), pero acota el impacto real.

## 3. Qué ya se corrigió (bajo riesgo, sin reescribir nada)

- `supabase/backups/` se dejó de versionar hacia adelante (`git rm -r --cached`). Los archivos siguen en disco, no se borraron.
- Rama `fix/REP-2908-VERIF-v02-backup-fuera-de-git`, pusheada. Pull Request pendiente de crear: [link](https://github.com/Mathiiuk/reportalo.mvp/compare/staging...fix/REP-2908-VERIF-v02-backup-fuera-de-git?expand=1).
- Esto **no resuelve el problema de fondo**: el backup sigue en los commits viejos de `staging`. Cualquiera que clone el repositorio en cualquier momento sigue recibiendo esos archivos.

## 4. Lo que falta — y por qué necesita coordinación antes de ejecutarse

La instrucción de Hernán es reescribir el historial:

```bash
git filter-repo --path supabase/backups --invert-paths
git push --force origin staging
```

Esto es la acción de mayor impacto de toda la revisión del RAG. Antes de ejecutarla, hay que entender exactamente qué produce:

| Consecuencia | Detalle |
|---|---|
| Se reescriben los commits de `staging` | Todo commit que tocó `supabase/backups/`, y todos los posteriores, cambian de hash |
| Se fuerza el push | El `staging` remoto se sobreescribe — no es un cambio incremental |
| Todo el equipo tiene que actuar | Cualquiera con una copia local de `staging` tiene que re-clonar o resetear duro contra el `staging` nuevo. Si alguien sigue trabajando sobre el `staging` viejo sin saberlo, puede volver a subir el backup sin querer, o generar conflictos serios |
| Los PR abiertos se ven afectados | Cualquier Pull Request contra `staging` (incluidos los que se abrieron hoy mismo durante esta revisión) puede quedar con conflictos después de la reescritura |

> **Recomendación.** No es una acción para ejecutar en solitario. Antes de correrla: avisar a Hernán, Leonel e Iván para que no pusheen nada contra `staging` mientras se hace, y coordinar el momento en que cada uno re-clona o resetea su copia local.

## 5. Próximos pasos

| # | Qué | A quién corresponde |
|---|---|---|
| 1 | Aprobar/mergear el PR de "dejar de versionar" (§3) | Hernán (revisión de base) |
| 2 | Avisar al equipo antes de la reescritura de historial — pausar pushes contra `staging` | Matías |
| 3 | Ejecutar `git filter-repo` + `push --force` sobre `staging` | Matías, con OK explícito |
| 4 | Confirmar que cada integrante re-clonó o reseteó su copia local | Hernán, Leonel, Iván |
| 5 | Guardar el backup fuera del repositorio, con acceso restringido | Matías |

---

**Documentos relacionados:** [REP-2908](https://unlz2026.atlassian.net/browse/REP-2908) · `REP-2908-VERIF_ronda2_hernan.md` · `REP-2908-VERIF_devolucion-a-hernan.docx`
