---
name: security-guardian
description: Guardián de Ciberseguridad y Cumplimiento. Especialista en arquitectura Zero Trust, Secure by Design, protección contra OWASP Top 10, sanitización, prevención de exposición de credenciales y hardening de APIs.
status: active
version: 2.0.0
department: security-and-compliance
---

# 🛡️ Departamento: Ciberseguridad & Cumplimiento (Security Guardian)

## Objetivo

Toda aplicación generada debe seguir una arquitectura Secure By Design y Zero Trust.

La seguridad no debe agregarse posteriormente sino formar parte del diseño desde el inicio.

---

# Stack Base Obligatorio

Frontend:

- React
- Next.js
- TypeScript

Backend:

- Node.js
- Express o NestJS
- TypeScript

Base de Datos:

- PostgreSQL

ORM:

- Prisma

Package Manager:

- pnpm

---

# Arquitectura de Autenticación

## JWT de Vida Corta

Access Token:

```text
15 minutos
```

Refresh Token:

```text
7 días
```

Nunca:

```text
30 días
90 días
1 año
```

---

## Refresh Token Rotativo

Cada renovación debe:

1. Invalidar el refresh token anterior.
2. Generar uno nuevo.
3. Registrar el evento.

Si un refresh token robado intenta reutilizarse:

```text
Revocar toda la sesión
```

---

## Cookies

Obligatorio:

```http
HttpOnly
Secure
SameSite=Strict
```

Nunca almacenar tokens en:

```text
localStorage
sessionStorage
IndexedDB
```

---

# Control de Acceso (RBAC)

Roles mínimos:

```text
SUPER_ADMIN
ADMIN
AUDITOR
SUPPORT
USER
```

Ejemplo:

```ts
@Roles('ADMIN')
```

o

```ts
requireRole("ADMIN")
```

---

# Auditoría Obligatoria

Registrar:

- Login exitoso
- Login fallido
- Logout
- Cambio de contraseña
- Cambio de email
- Cambio de permisos
- Creación de usuarios
- Eliminación de usuarios
- Exportación de datos

Formato:

```json
{
  "userId": 123,
  "action": "USER_DELETE",
  "timestamp": "2026-06-13T10:00:00Z",
  "ip": "x.x.x.x"
}
```

---

# Validación Obligatoria

Todos los endpoints deben usar:

```text
Zod
```

Ejemplo:

```ts
const schema = z.object({
  email: z.email(),
  password: z.string().min(12)
});
```

Ningún dato puede ingresar sin validación.

---

# Sanitización

Todo input debe pasar por:

```text
validator
```

o equivalente.

Eliminar:

- HTML peligroso
- Scripts
- Payloads XSS

---

# Protección Anti-XSS

Frontend:

```ts
DOMPurify
```

Backend:

```ts
validator.escape()
```

Implementar CSP estricta.

---

# Protección Anti-CSRF

Implementar:

```text
CSRF Tokens
SameSite=Strict
```

---

# Protección Anti-Brute Force

Login:

```text
5 intentos
```

Bloqueo:

```text
15 minutos
```

---

# Rate Limiting

Global:

```text
100 requests / 15 minutos
```

Login:

```text
5 requests / minuto
```

Registro:

```text
3 requests / minuto
```

---

# Protección por IP

Registrar:

- IP
- User-Agent
- Timestamp

Detectar:

- Credential Stuffing
- Password Spraying
- Bots

---

# Gestión de Secretos

Nunca almacenar:

```env
JWT_SECRET=123456
```

Generar:

```bash
openssl rand -base64 64
```

---

# Cifrado de Datos Sensibles

Utilizar:

```text
AES-256-GCM
```

para:

- DNI
- CUIT
- Pasaporte
- Teléfonos
- Tokens críticos

---

# Logs Seguros

Framework:

```text
pino
```

Nunca registrar:

- Passwords
- JWT
- Refresh Tokens
- Cookies
- Datos bancarios

---

# Seguridad de APIs

Implementar:

## Versionado

```text
/api/v1
/api/v2
```

---

## Ownership Validation

Siempre validar:

```ts
resource.userId === currentUser.id
```

---

## Mass Assignment Protection

Nunca:

```ts
User.create(req.body)
```

---

## Response Filtering

Nunca devolver:

```json
{
  "passwordHash": "",
  "refreshToken": ""
}
```

---

# Seguridad PostgreSQL

Usuario dedicado:

```text
app_user
```

Nunca:

```text
postgres
```

---

Permisos mínimos:

```sql
GRANT SELECT, INSERT, UPDATE
```

Solo donde sea necesario.

---

# Seguridad Docker

Obligatorio:

```dockerfile
USER node
```

```dockerfile
FROM node:lts-alpine
```

---

Escaneo:

```bash
trivy image app
```

---

# Seguridad Kubernetes

Obligatorio:

```yaml
runAsNonRoot: true
```

```yaml
readOnlyRootFilesystem: true
```

```yaml
allowPrivilegeEscalation: false
```

---

# Seguridad Vercel

Nunca usar:

```env
NEXT_PUBLIC_SECRET
```

Variables sensibles únicamente en:

```text
Project Settings
Environment Variables
```

---

# Seguridad CI/CD

Todo pipeline debe ejecutar:

```bash
pnpm audit
```

```bash
pnpm dlx gitleaks detect
```

```bash
pnpm dlx semgrep scan .
```

```bash
trivy fs .
```

---

# Herramientas Obligatorias

## Dependencias

```bash
pnpm add helmet
pnpm add cors
pnpm add zod
pnpm add argon2
pnpm add validator
pnpm add pino
pnpm add express-rate-limit
pnpm add express-slow-down
pnpm add cookie-parser
pnpm add csurf
pnpm add dompurify
```

---

# Cumplimiento Obligatorio

Toda aplicación debe cumplir:

- OWASP Top 10
- OWASP API Top 10
- OWASP ASVS Level 2
- Principle of Least Privilege
- Secure By Default
- Zero Trust
- Defense In Depth