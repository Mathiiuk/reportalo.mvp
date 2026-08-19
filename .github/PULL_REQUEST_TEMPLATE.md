## 📌 Ticket de Jira
- Jira Key: `[REP-XXXX]` <!-- Reemplazar con el ID del ticket, ej. REP-3308 -->
- Tipo: `Feature` | `Bugfix` | `Hotfix` | `Chore` | `Release`
- Rama Destino: `staging` (para features/fixes) | `main` (para releases aprobadas)

---

## 📝 Descripción del Cambio
<!-- Explicar brevemente qué problema se resolvió, qué se implementó y el impacto técnico/funcional -->

---

## 🌐 Despliegue en Vercel
- [ ] **Preview Deployment**: Comprobar el comentario del bot `vercel[bot]` con la URL del preview.
- URL de Preview: <!-- Pegar URL generada para facilitar revisión a QA -->

---

## 🧪 Checklist de Validación para Ivan Juarez (QA)
- [ ] **Acceso Público**: Abre sin solicitar credenciales ni login de Vercel.
- [ ] **Criterios de Aceptación**: Cumple todos los requerimientos especificados en Jira.
- [ ] **Responsive & UX**: Validado en Desktop, Tablet y Mobile.
- [ ] **Consola Limpia**: Sin errores JavaScript no controlados ni excepciones HTTP 500.
- [ ] **Offline Resilience**: Comportamiento verificado con/sin conexión.

---

## 🛡️ Definition of Done (DoD)
- [ ] Código alineado a los estándares de arquitectura y sin credenciales expuestas.
- [ ] Quality gates locales ejecutados y pasados (`lint`, `tests`, `build`).
- [ ] Pipelines de CI (`ci.yml`) y Seguridad (`security.yml`) en estado verde.
- [ ] Aprobación formal registrada en este Pull Request antes del merge.
