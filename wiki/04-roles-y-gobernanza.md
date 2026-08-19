---
title: "Roles y Gobernanza — Equipo y Matriz RACI"
description: "Estructura organizativa oficial del proyecto Reportalo (RAR-2026), roles del equipo (Carlos, Leonel, Matías, Hernán, Ivan) y matriz RACI de responsabilidades."
---

# 👥 Roles y Gobernanza del Proyecto

Este documento establece la conformación oficial del equipo, responsabilidades y normas de gobernanza técnica para el desarrollo de **Reportalo (RAR-2026)** ([`docs/project/acta-de-inicio-v3.md:14-25`](https://github.com/Mathiiuk/reportalo.mvp/blob/main/docs/project/acta-de-inicio-v3.md#L14-L25)).

---

## 1. Estructura Oficial del Equipo

```mermaid
graph TD
    CR["<b>Carlos Ruiz</b><br>Sponsor y Auditor"]
    LN["<b>Leonel Nuñez</b><br>Project Manager (PM)"]
    HG["<b>Hernán Gregorini</b><br>Product Owner / Autor (PO)"]
    MK["<b>Matías Krepchuk</b><br>Líder Técnico"]
    IJ["<b>Ivan Juarez</b><br>QA y UX/UI"]

    CR --- LN
    CR --- HG
    LN --- MK
    HG --- MK
    MK --- IJ
```
<!-- Sources: docs/project/acta-de-inicio-v3.md:14-25, docs/project/acta-de-inicio-v3.md:88-96 -->

---

## 2. Descripción de Roles y Atribuciones

| Integrante | Rol Oficial | Responsabilidades Clave | Fuente |
| :--- | :--- | :--- | :--- |
| **Carlos Ruiz** | **Sponsor y Auditor** | Define criterios de aceptación estratégicos; interlocutor final para decisiones de alto nivel. | [`docs/project/acta-de-inicio-v3.md:90`](https://github.com/Mathiiuk/reportalo.mvp/blob/main/docs/project/acta-de-inicio-v3.md#L90) |
| **Leonel Nuñez** | **Project Manager (PM)** | Planificación, gestión de tiempos, remoción de bloqueos y coordinación de ceremonias ágiles. | [`docs/project/acta-de-inicio-v3.md:91`](https://github.com/Mathiiuk/reportalo.mvp/blob/main/docs/project/acta-de-inicio-v3.md#L91) |
| **Hernán Gregorini** | **Product Owner (PO) / Autor** | Definición de backlog, redacción y priorización de historias de usuario, valor para ciudadano y organismo. | [`docs/project/acta-de-inicio-v3.md:93`](https://github.com/Mathiiuk/reportalo.mvp/blob/main/docs/project/acta-de-inicio-v3.md#L93) |
| **Matías Krepchuk** | **Líder Técnico** | Arquitectura del sistema, desarrollo de componentes críticos, code review, CI/CD y despliegues. | [`docs/project/acta-de-inicio-v3.md:92`](https://github.com/Mathiiuk/reportalo.mvp/blob/main/docs/project/acta-de-inicio-v3.md#L92) |
| **Ivan Juarez** | **QA y UX/UI** | Aseguramiento de calidad, pruebas en dispositivos reales, validación de integración y diseño de interfaz/experiencia. | [`docs/project/acta-de-inicio-v3.md:94`](https://github.com/Mathiiuk/reportalo.mvp/blob/main/docs/project/acta-de-inicio-v3.md#L94) |

---

## 3. Matriz RACI del Ciclo de Desarrollo

```mermaid
flowchart LR
    A["Jira Requerimiento<br>(Hernán / Leonel)"] --> B["Arquitectura & Código<br>(Matías)"]
    B --> C["Testing en Previews<br>(Ivan)"]
    C --> D["Aprobación de Release<br>(Carlos / Leonel)"]
    D --> E["Despliegue Producción<br>(Matías)"]
```
<!-- Sources: docs/project/acta-de-inicio-v3.md:88-96, skills/software-delivery-workflow.md:38-64 -->

| Actividad / Hito | Carlos (Sponsor) | Leonel (PM) | Hernán (PO) | Matías (Tech Lead) | Ivan (QA/UX) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Definición de Alcance e Historias** | **I** | **C** | **A / R** | **C** | **C** |
| **Sprint Planning & Estimaciones** | **I** | **A / R** | **C** | **R** | **R** |
| **Arquitectura y Core Development** | **I** | **I** | **I** | **A / R** | **I** |
| **Diseño UX/UI y Accesibilidad** | **C** | **I** | **A** | **C** | **R** |
| **Validación en Vercel Previews** | **I** | **I** | **C** | **I** | **A / R** |
| **Aprobación de Pull Requests** | **I** | **I** | **I** | **A** | **R** |
| **Despliegue a Producción (Merge)** | **A** | **C** | **C** | **R** | **I** |

> **Leyenda RACI**: **R** = Responsable de ejecución, **A** = Aprobador final (Accountable), **C** = Consultado, **I** = Informado.

---

## 4. Políticas de Gobernanza y Convenciones

1. **Gestión de Tareas**: Toda tarea nace con un identificador de Jira (`REP-XXXX`) y un archivo manifest en `docs/workflow/tasks/`.
2. **Convención de Ramas**: `feat/<ID>-slug`, `fix/<ID>-slug`, `hotfix/<ID>-slug`.
3. **Commits en Español**: Siguiendo el estándar *Conventional Commits* con descripción clara.
4. **Validación Obligatoria de QA**: Ninguna rama se mergea a `main` sin la aprobación de Ivan Juarez en el Pull Request.

---

## Related Pages

| Página | Relación |
| :--- | :--- |
| [Inicio (Home)](Home) | Portal general de la Wiki |
| [Acta de Inicio](01-acta-de-inicio) | Visión y compromisos estratégicos del proyecto |
| [Flujo de Trabajo](02-flujo-de-trabajo) | Metodología de entrega y máquina de estados |
| [Guía QA & Testing](03-guia-qa-testing) | Procedimientos de prueba para Ivan Juarez |
