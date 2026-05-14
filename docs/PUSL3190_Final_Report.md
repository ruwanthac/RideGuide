# PUSL3190 Computing Project — Final Report

**RideGuide: An Integrated Vehicle Diagnosis, Roadside Assistance, and Administration Platform**

---

## Title Page *(replace with official faculty template from the portal)*

| Field | Entry |
|--------|--------|
| **Module** | PUSL3190 Computing Project |
| **Report title** | RideGuide: An Integrated Vehicle Diagnosis, Roadside Assistance, and Administration Platform |
| **Student name** | *[Full name]* |
| **PU student number** | *[e.g. 1234567]* |
| **Programme** | *[e.g. BSc (Hons) Computer Science]* |
| **Submission date** | May 2026 |
| **Word count (main body)** | *[Sections 1–9 only — excludes References, Bibliography, Appendices]* |

---

## Acknowledgements

The author wishes to acknowledge the supervision and feedback provided by the project supervisor throughout the development lifecycle. Thanks are extended to participants who supplied informal usability observations during iterative testing of the mobile application. The open-source communities maintaining Expo, React Native, Express, and related tooling are recognised for documentation and examples that accelerated integration work. Any remaining errors or omissions in this report are the sole responsibility of the author.

---

## Abstract

Vehicle operators frequently lack a single, trustworthy channel that connects fault description, standardised diagnostic codes, guided interpretation, and coordinated access to roadside mechanical assistance or towing. Commercial offerings are often fragmented across original-equipment applications, generic OBD readers, and ad-hoc messaging services, which limits continuity of context when an incident occurs.

This computing project designed and implemented **RideGuide**, a multi-component software system addressing that gap. The **deliverables** comprised: (1) a cross-platform **mobile application** built with Expo and React Native (TypeScript) for vehicle owners, mechanics, and tow operators; (2) a **RESTful and WebSocket-enabled backend** using Node.js, Express, MongoDB (Mongoose), Socket.IO, and Google Gemini for artificial-intelligence-assisted diagnosis and conversational assistance; and (3) a **web-based administrative dashboard** (Vite, React, TypeScript) for authenticated administrators to monitor usage, manage accounts and service requests, and configure operational parameters such as tow pricing and job-list radius rules.

Functional scope included user authentication, vehicle profiles, symptom- and OBD-code-based diagnosis with structured severity output, AI chat including multimodal extensions where supported by the API, creation and tracking of roadside and tow service requests with map-centred interfaces, provider-side acceptance workflows, and audit-aware administrative operations. Non-functional goals emphasised type safety, schema-validated configuration, layered service architecture, automated backend testing with in-memory MongoDB and mocked external AI calls, and security measures including JWT authorisation, role guards, rate limiting on authentication routes, and HTTP hardening middleware.

The project followed an iterative, specification-driven approach with continuous integration of mobile, server, and dashboard clients against a shared API contract. The **end-project evaluation** concluded that core objectives were substantially met, with limitations acknowledged around production scalability evidence, formal accessibility auditing, and dependence on third-party AI availability and policy. A structured **post-mortem** identified strengths in technology fit and test discipline, and weaknesses in early risk documentation for mobile keyboard ergonomics and cross-role regression coverage.

**Keywords:** vehicle diagnosis; OBD-II; roadside assistance; towing; React Native; Expo; Express; MongoDB; Socket.IO; Gemini; administrative dashboard; JWT.

---

## Table of Contents

1. [Introduction](#1-introduction)  
2. [Background, Objectives and Deliverables](#2-background-objectives-and-deliverables)  
3. [Literature Review](#3-literature-review)  
4. [Method of Approach](#4-method-of-approach)  
5. [Requirements Specification](#5-requirements-specification)  
6. [Technical Design and System Implementation](#6-technical-design-and-system-implementation)  
7. [End-Project Report](#7-end-project-report)  
8. [Project Post-Mortem](#8-project-post-mortem)  
9. [Conclusions](#9-conclusions)  
10. [Reference List](#10-reference-list)  
11. [Bibliography](#11-bibliography)  
12. [Appendices](#12-appendices)  

---

## List of Figures

| No. | Caption *(insert screenshots in Word/PDF)* |
|-----|---------------------------------------------|
| Figure 1 | Mobile application: authentication screen. |
| Figure 2 | Mobile application: home dashboard. |
| Figure 3 | Mobile application: diagnosis input (symptoms and OBD). |
| Figure 4 | Mobile application: AI assistant conversation. |
| Figure 5 | Mobile application: assistance map and request flow. |
| Figure 6 | Mobile application: owner tracking or provider active job. |
| Figure 7 | Admin dashboard: statistics overview. |
| Figure 8 | Admin dashboard: users and requests. |
| Figure 9 | Admin dashboard: tow pricing and settings. |
| Figure 10 | System architecture (clients, API, database, external services). |

## List of Tables

| No. | Caption |
|-----|---------|
| Table 1 | Stakeholder summary. |
| Table 2 | Functional requirements traceability. |
| Table 3 | Non-functional requirements. |
| Table 4 | API route prefixes. |
| Table 5 | Technology stack by tier. |
| Table 6 | Objective achievement matrix. |

---

# Main Body

## 1. Introduction

Modern road transport depends on rapid, accurate communication between a driver, diagnostic information, and service providers when a fault or immobilisation event arises. Many motorists experience difficulty translating subjective symptoms into actionable technical language, and standard on-board diagnostics (OBD-II) codes are frequently misinterpreted without contextual guidance. Dispatch-oriented assistance—mechanical roadside help or towing—additionally requires trustworthy identity, location, and status synchronisation among heterogeneous actors.

The **purpose** of this project was to engineer a coherent software ecosystem that reduced fragmentation by unifying guided diagnosis, conversational artificial intelligence, and multi-role service logistics within one platform referred to in this submission as **RideGuide**. The **scope** encompassed three deployable artefacts: a consumer- and provider-facing mobile client, a secure application programming interface with persistence and real-time channels, and an operations-facing web dashboard.

The **structure of this report** follows Plymouth University PUSL3190 guidance. The main body progresses from motivation and objectives through literature-informed positioning, methodology, requirements, technical realisation, summative evaluation, critical post-mortem reflection, and concise conclusions. Extended subsections in the literature, method, implementation, and evaluation chapters (for example OBD context, privacy, auditability, risk management, narrative walkthroughs, and quantitative reflection) were included so that the narrative remained self-contained for examination while avoiding large code excerpts, in line with module advice. **Referencing** adheres to Harvard-style citations in the Reference List; wider orientation reading is listed under Bibliography. **Code listings** were excluded from the main narrative; repository paths and module naming were used instead, with procedural detail placed in the **User Guide** appendix.

The report was drafted for **third-person**, predominantly **past-tense**, **formal** academic prose, with **passive voice** used where it improved objectivity, and without conversational phrasing or personal pronouns where faculty style discouraged them.

---

## 2. Background, Objectives and Deliverables

### 2.1 Background

The problem domain sat at the intersection of **consumer mobility applications**, **automotive diagnostics**, and **multi-sided service marketplaces**. Owners required reassurance and next-step guidance; independent mechanics and tow operators required discoverable jobs with configurable visibility rules; administrators required policy levers without direct database manipulation. Partial solutions existed in isolation; their integration under one account and history model was the engineering contribution.

Discourse on **information asymmetry** between technicians and lay users has long influenced interface design for warnings and manuals. Recent advances in **large language models** motivated structured use of generative explanation when paired with server-side validation, persistence, and non-replacement disclaimers relative to certified inspection.

### 2.2 Objectives

The **primary objectives** were:

1. To implement a **secure multi-user backend** supporting registration, authentication, role separation (owner, mechanic, tow, administrator), and auditable administrative mutations.  
2. To deliver a **mobile client** capable of vehicle management, AI-assisted diagnosis from symptoms and optional OBD codes, AI chat (including image-oriented flows where supported), and lifecycle management of roadside and tow requests including mapping and request-scoped chat.  
3. To deliver an **administrative SPA** for statistics, user and request oversight, diagnosis and vehicle registers, audit logs, and configuration of tow hire rate, provider job radius, and unclaimed-request expiry.  
4. To apply **software engineering discipline**: modular layering, validated environment configuration, automated tests for critical backend paths, and documentation suitable for handover.

**Secondary objectives** included real-time updates via WebSockets, optional email notification hooks, and responsive mobile layouts.

### 2.3 Deliverables

|  | Description | Repository path |
|-------------|-------------|-----------------|
| D1 | Mobile application | `RideGuide-main/` |
| D2 | Backend API and sockets | `backend/` |
| D3 | Admin dashboard | `admin dashboard rideguide/` |
| D4 | Backend automated tests | `backend/tests/` |
| D5 | Admin API documentation | `backend/docs/ADMIN_API.md` |
| D6 | Environment templates | `backend/.env.example`, dashboard `.env.example` |

**Table 1 — Stakeholder summary**
a
| Stakeholder | Interest | Primary interface |
|-------------|----------|-------------------|
| Vehicle owner | Guidance, assistance | Mobile app |
| Mechanic / tow provider | Jobs, status | Mobile app |
| Administrator | Policy, oversight | Web dashboard |
| Examiner | Reproducibility | Report + code link |

---

## 3. Literature Review

### 3.1 Human factors and progressive disclosure

Driver comprehension studies emphasised that dense technical fault dumps increased anxiety without improving safe behaviour. **Progressive disclosure**—staging severity, likelihood, and recommended checks—informed the structured diagnosis payload (severity, likely causes, recommended steps) rendered as cards in the mobile client.

### 3.2 Marketplaces and trust

Marketplace literature highlighted **transparent pricing** and **visible status** as adoption drivers. Administrative tow rate configuration and request expiry policies partially operationalised pricing transparency for providers browsing open work.

### 3.3 Generative AI in safety-adjacent contexts

Industry guidance recommended **schema constraints**, **monitoring**, and clear labelling that model output was **advisory**. The architecture separated **deterministic persistence** from **stochastic generation**, with tests mocking vendor APIs to preserve repeatability.

### 3.4 Real-time architectures

Event-driven updates via **WebSockets** were favoured over naive polling for incident-style objects with multiple subscribers. Socket.IO was adopted for ecosystem maturity with Express and for JWT-authenticated connection patterns documented in community practice.

### 3.5 OBD-II context

On-board diagnostics standards historically enabled workshop scan tools to interrogate emission-related controllers. Consumer-facing interpretation remained uneven because codes such as catalyst efficiency faults could stem from multiple physical root causes. The project therefore treated OBD input as **structured evidence** to be combined with natural-language symptoms rather than as a sole determinant of narrative output.

### 3.6 Privacy and location ethics

Location sharing for dispatch introduced **privacy risk** proportional to retention duration and precision. Literature on location privacy recommended minimising stored precision where possible, exposing clear consent flows, and limiting background collection to active incidents. The implementation favoured permission-gated access and incident-scoped usage patterns aligned with mobile platform guidelines.

### 3.7 Admin auditability

Governance literature on administrative systems emphasised **separation of duties** and **append-only audit trails** for sensitive mutations. Partial alignment was achieved through audit log records for selected administrative actions, acknowledging that a full SOC2-style control matrix was out of scope.

---

## 4. Method of Approach

### 4.1 Requirements gathering

Requirements were gathered via **supervisor-led scoping**, **competitive review** of automotive and towing applications, and **iterative debriefs** after implementation sprints. Informal walkthroughs informed navigation density and the need for dedicated tracking screens after request acceptance.

### 4.2 Process model

A **lightweight iterative** model was used: small story definition; API or schema adjustment when needed; backend implementation with tests; client integration; manual smoke testing on simulators. **Git** supported traceability of changes and rollback.

### 4.3 Technology selection

**Expo / React Native** enabled cross-platform delivery with mature device APIs. **Express** gave explicit routing control. **MongoDB** accommodated evolving documents. **Gemini** was selected for documentation quality and prototyping suitability. Trade-offs included vendor dependence and schema evolution discipline.

### 4.4 Quality practices

Backend quality combined **Jest** integration tests, **mongodb-memory-server**, **mocked AI clients**, **TypeScript**, and **Zod-validated environment** loading. Mobile and dashboard packages were typechecked; exhaustive UI automation was not completed within schedule.

### 4.5 Tooling

Development used Node.js LTS on macOS. CORS was configured explicitly for dashboard origins rather than wildcard deployment defaults.

### 4.6 Version control and release hygiene

Feature work was committed in small increments with descriptive messages. Tags were used sparingly; release discipline relied on manual checklists prior to demonstration milestones rather than continuous deployment pipelines.

### 4.7 Risk management (lightweight)

Key risks were catalogued mid-project: third-party AI outage, map SDK quota exhaustion, socket scale unknowns, and schedule slip on UI polish. Mitigations included mocked tests, offline-capable fallbacks for read-only history where feasible, and scope triage on non-critical animations.

### 4.8 Documentation strategy

Documentation was split between examiner-facing narrative (this report), developer-facing repository README files, and machine-adjacent admin API markdown. Duplication was minimised by referencing paths rather than repeating full endpoint tables in the main body.

---

## 5. Requirements Specification

### 5.1 Functional requirements

**Table 2 — Functional requirements traceability**

| ID | Requirement | Realisation |
|----|-------------|-------------|
| FR-1 | Register, login, JWT | `/api/auth`, mobile auth context |
| FR-2 | Vehicle CRUD | `/api/vehicles` |
| FR-3 | Diagnosis + history | `/api/diagnosis`, `/api/diagnosis-history` |
| FR-4 | AI assistant | `/api/chat` assistant routes |
| FR-5 | Requests lifecycle | `/api/requests`, mechanics routes, sockets |
| FR-6 | Maps / radius jobs | Location APIs, admin radius settings |
| FR-7 | Real-time updates | Socket.IO |
| FR-8 | Admin stats, audit | `/api/admin/*` |
| FR-9 | Tow pricing config | Admin settings, pricing configuration store |

### 5.2 Non-functional requirements

**Table 3 — Non-functional requirements**

| ID | Category | Requirement | Evidence |
|----|----------|-------------|----------|
| NFR-1 | Security | JWT + role guards | Middleware |
| NFR-2 | Security | HTTP headers | Helmet |
| NFR-3 | Security | Auth rate limit | Rate limiter on auth routes |
| NFR-4 | Security | JSON size cap | Express JSON limit |
| NFR-5 | Maintainability | Typing, services | TypeScript layout |
| NFR-6 | Reliability | Error handler | Global middleware |
| NFR-7 | Testability | In-memory DB | Test helpers |

### 5.3 Constraints

Constraints included third-party **maps**, **AI quotas**, and optional **email** deliverability. Production app-store **background location** policies required conservative permission UX.

---

## 6. Technical Design and System Implementation

### 6.1 Architecture

A **three-tier** design was used: mobile SPA and admin SPA; Express application layer; MongoDB persistence. **Figure 10** should illustrate HTTPS + JWT to `/api`, WebSocket connections for realtime, and outbound Gemini/email calls.

### 6.2 Backend

The HTTP application factory applied security-oriented middleware, CORS, JSON body limits, mounted `/api` routers (`auth`, `users`, `vehicles`, `diagnosis`, `diagnosis-history`, `requests`, `chat`, `mechanics`, `admin`), and a global error handler. Controllers delegated to **services** to preserve test seams.

**Table 4 — API route prefixes**

| Prefix | Role |
|--------|------|
| `/api/auth` | Credentials |
| `/api/users` | Profiles |
| `/api/vehicles` | Garages |
| `/api/diagnosis` | Live diagnosis |
| `/api/diagnosis-history` | Records |
| `/api/requests` | Assistance |
| `/api/chat` | Assistant |
| `/api/mechanics` | Providers |
| `/api/admin` | Privileged ops |

Socket.IO authenticated connections with JWT-aligned verification and emitted updates to relevant rooms when request state changed.

### 6.3 Data model

Key collections included **User**, **Vehicle**, **DiagnosisHistory**, **ServiceRequest**, **ChatMessage**, **AdminAuditLog**, and **PricingConfig** (singleton-style tow configuration). References were enforced by application logic and Mongoose schemas.

### 6.4 Mobile client

Navigation combined **bottom tabs** and **native stacks** for deep flows (diagnose, assistant, assistance, request chat/map, histories, profile). **Context** providers carried authentication, vehicles, notifications, and ongoing activity. Theming used a primary blue palette on neutral backgrounds.

**Keyboard interaction** was refined mid-project: multiline diagnosis fields initially allowed the software keyboard to obscure primary actions on small screens; mitigations included keyboard-avoiding layout, platform-specific inset adjustment, supplementary scroll padding informed by keyboard height on Android, and deferred scrolling to the end of the scroll view on focus events for critical inputs.

### 6.5 Admin dashboard

A Vite React SPA consumed JSON only. Pages included statistics, filtered tables, audit visibility, and settings for tow per kilometre (LKR), provider job radius, and unclaimed request expiry. Administrative routes required an administrative role on the bearer token.

### 6.6 Security

Passwords were stored hashed; secrets were environment-only; sensitive admin actions wrote **audit logs**. CORS origins were enumerated for non-experimental deployments.

### 6.7 Testing

Tests under `backend/tests/` covered routes (auth, users, vehicles, diagnosis, requests, chat, assistant, mechanic, admin, provider registration, records), services (auth, email, Gemini), models, middleware, and health. External AI was mocked for determinism.

**Table 5 — Technology stack**

| Tier | Stack |
|------|--------|
| Mobile | Expo ~54, RN, React Navigation 7, TS |
| API | Node, Express 4, Socket.IO, Mongoose, Zod |
| AI | Google Gemini SDKs |
| Admin | Vite, React, TS |
| DB | MongoDB |

### 6.8 Representative owner journey (narrative)

An owner account was created, a vehicle record was attached where the account model required it, and a diagnosis was requested using both a short symptom phrase and an uppercase OBD token. The structured response displayed severity and enumerated likely causes and steps. The same account navigated to assistance features, initiated a request with location context, and observed status transitions when provider-side actions were simulated in testing. Request-scoped chat was used to exchange short textual updates. **Figures 3–6** should illustrate these stages after screenshot capture.

### 6.9 Representative provider journey (narrative)

A provider account with mechanic or tow role signed in, confirmed availability flags where applicable, and listed open jobs. When administrative radius configuration and live coordinates were both present, the listing behaviour was constrained geographically; when coordinates were absent, legacy listing behaviour was documented as a compatibility path. Upon acceptance, active job screens were used until completion markers were recorded.

### 6.10 Administrative configuration narrative

An administrator adjusted tow hire rate per kilometre, provider job radius, and unclaimed request expiry. Changes were persisted server-side and reflected in subsequent provider browsing sessions during integration tests. Audit entries were inspected to confirm that sensitive mutations left traceable records suitable for operational review.

### 6.11 Error handling and observability limits

Structured API errors were returned for validation failures and common fault classes. Centralised handling reduced duplicated try/catch noise in routers. Production-grade observability (structured logging pipelines, metrics, distributed tracing) was not implemented; limitations are acknowledged for industrial deployment.

### 6.12 Internationalisation and localisation

The prototype was authored primarily in English. Currency displays for administrative tow settings referenced LKR context in interface copy where applicable. A full i18n framework was not introduced due to schedule constraints.

---

## 7. End-Project Report

### 7.1 Summary of achievements

A **three-part system** was delivered: mobile client, tested backend with sockets, and admin dashboard aligned to documented endpoints. End-to-end journeys—registration, diagnosis, AI chat, request placement, provider acceptance, administrative configuration—were demonstrated in integrated local runs.

### 7.2 Objective evaluation

**Table 6 — Objective achievement**

| Objective | Status | Notes |
|-----------|--------|-------|
| Multi-role secure backend | Achieved | JWT, guards, audits |
| Mobile diagnosis + assistance | Achieved | Wired to API |
| Admin oversight + settings | Achieved | Tow/radius/expiry |
| Engineering discipline | Substantial | Strong server tests; limited E2E UI tests |

### 7.3 Criticism and shortcomings

Formal **load testing** of concurrent sockets was not completed. **Accessibility** (WCAG-oriented audits) was partial. **AI availability** depended on keys and vendor policy. Some **denormalised** fields on requests favoured read speed over strict normalisation.

### 7.4 Stakeholder feedback

The **supervisor** acted as product owner where no commercial client existed. Informal observers requested clearer **role differentiation** on home entry points; navigation was partially regrouped in response.

### 7.5 Business objectives

Business goals were framed academically: **feasibility** of an integrated prototype and **reduced driver uncertainty** during faults. Revenue models were out of scope.

### 7.6 Changes and effects

Notable changes: expanded **admin tow settings** (radius, expiry); increased **JSON body limit** for multimodal chat; **keyboard avoidance** on diagnosis and assistant screens. Backend regressions were caught by automated tests; mobile regressions relied more on manual scripts.

### 7.7 Quantitative reflection (illustrative)

Automated backend tests were distributed across routes, services, models, and middleware, with external AI dependencies mocked. Exact counts should be recorded from `npm test` output at submission time and tabulated if the examiner requests empirical rigour. Lines-of-code statistics, if desired, should be generated by repository tooling rather than manual counting.

### 7.8 Demonstration risks encountered

Demonstration rehearsals exposed intermittent issues when environment variables were unset (for example missing Gemini key leading to controlled error paths). Checklists were created to ensure demonstration machines carried valid `.env` files without committing secrets.

### 7.9 Alignment with original PID

Where the PID emphasised mobile-first delivery, the final artefact matched that emphasis while expanding administrative completeness beyond the earliest draft scope. Deviations were documented through supervisor agreement rather than silent scope creep.

### 7.10 Ethical positioning of AI advice

User-visible framing continued to position model output as **non-definitive** relative to workshop inspection. That positioning was judged ethically necessary given hallucination risk classes documented in generative AI literature.

---

## 8. Project Post-Mortem

### 8.1 Objectives appropriateness

Objectives were **appropriate** for final-year breadth: full-stack delivery without unrealistic research claims. Breadth compressed time for deep performance work.

### 8.2 Specification quality

Iterative flexibility helped responsiveness; late finalisation of some **edge-case rules** caused short-term client–server message mismatch. Earlier **contract-first API** publication might have reduced rework.

### 8.3 Client relationship

With no external client, the **supervisor** fulfilled prioritisation. More formal **acceptance criteria** per milestone would have reduced ambiguity.

### 8.4 Process suitability

Lightweight iteration suited a **single-developer** cadence. Git history proved essential for regression diagnosis.

### 8.5 Technology fit

**Expo** accelerated device features at the cost of occasional upgrade overhead. **MongoDB** matched schema fluidity. **Gemini** met explanatory needs with acknowledged lock-in.

### 8.6 Performance reflection

Initial **UI polish** estimates proved optimistic; scope triage preserved schedule. Backend testing discipline offset thinner UI automation.

### 8.7 Lessons learned

Future work would add: earlier **multi-device** keyboard testing; **versioned API contracts**; **feature flags** for prompt experiments; expanded **E2E** coverage for critical flows.

### 8.8 Alternative architecture considered

A monolithic server-rendered web application with a thin mobile shell was considered and rejected due to weaker alignment with native map and notification ergonomics desired for roadside contexts.

### 8.9 Database choice reflection

A relational database might have simplified certain reporting joins at the cost of slower schema iteration early in the project. The document store choice was retrospectively validated for prototyping speed but noted as a migration consideration if complex reporting became dominant.

### 8.10 Sustainability of maintenance

Long-term maintainability would benefit from automated dependency update cadences, pinned security reviews for JWT libraries, and periodic penetration testing. Those activities were not fully executed within the project window.

---

## 9. Conclusions

RideGuide integrated **mobile**, **server**, and **administrative** software into one platform for AI-assisted diagnosis and assistance logistics. Core objectives were met to a standard suitable for academic assessment, with documented limitations in UI automation depth, accessibility certification, and production-scale performance evidence. The system remains extensible toward reputation, richer analytics, and internationalisation. The project demonstrated applied full-stack engineering under third-party service constraints.

---

## 10. Reference List *(Harvard — verify dates/URLs in Word)*

Expo (2026) *Expo Documentation*. Available at: https://docs.expo.dev/ (Accessed: 12 May 2026).

Express.js (2026) *Express Guide*. Available at: https://expressjs.com/ (Accessed: 12 May 2026).

Google AI (2026) *Gemini API Documentation*. Available at: https://ai.google.dev/docs (Accessed: 12 May 2026).

Mongoose (2026) *Mongoose Documentation*. Available at: https://mongoosejs.com/ (Accessed: 12 May 2026).

MongoDB Inc. (2026) *MongoDB Manual*. Available at: https://www.mongodb.com/docs/manual/ (Accessed: 12 May 2026).

React Navigation (2026) *React Navigation Documentation*. Available at: https://reactnavigation.org/ (Accessed: 12 May 2026).

React Native (2026) *React Native Documentation*. Available at: https://reactnative.dev/ (Accessed: 12 May 2026).

Socket.IO (2026) *Socket.IO Documentation*. Available at: https://socket.io/docs/v4/ (Accessed: 12 May 2026).

Vite (2026) *Vite Guide*. Available at: https://vitejs.dev/guide/ (Accessed: 12 May 2026).

---

## 11. Bibliography

Norman, D.A. (2013) *The Design of Everyday Things: Revised and Expanded Edition.* New York: Basic Books.

Newman, S. (2021) *Building Microservices: Designing Fine-Grained Systems.* 2nd edn. Sebastopol: O’Reilly.

Fowler, M. (2018) *Refactoring: Improving the Design of Existing Code.* 2nd edn. Boston: Addison-Wesley.

---

## 12. Appendices *(confirm exclusion from word count on portal)*

### Appendix A — User Guide *(cross-referenced from §6)*

**Prerequisites:** Node.js LTS; MongoDB; Gemini keys if AI enabled; Expo Go or simulators.

**Backend:** Install dependencies in `backend/`, copy `.env.example` to `.env`, populate variables, run the development server, verify `/api/health`.

**Mobile:** Install dependencies in `RideGuide-main/`, configure API base URL per project conventions, start Expo, run on device or simulator.

**Admin:** Install dependencies in `admin dashboard rideguide/`, configure API base URL or Vite proxy target, ensure backend CORS allows the dashboard origin, start Vite, sign in with an administrative user.

**Owner journey:** register → add vehicle where used → run diagnosis → optional AI chat → create roadside or tow request → track status → consult history.

**Provider journey:** sign in as mechanic or tow role → set availability where required → browse open jobs (radius-filtered when live location is present) → accept job → map/chat to completion.

**Admin journey:** review statistics → manage users and requests where permitted → review audit entries → adjust tow pricing, provider radius, and unclaimed expiry → save changes.

### Appendix B — Source Code (OneDrive) *[mandatory: missing link may result in zero marks]*

**OneDrive URL (evaluator access granted):** *[PASTE FULL LINK]*

### Appendix C — Repository and Commit History

**Git remote URL:** *[if permitted]*  
**Commit history evidence:** *[PDF export or screenshots per faculty instruction]*

### Appendix D — PID

*[Insert PID document]*

### Appendix E — Interim Reports

*[Insert interim submissions]*

### Appendix F — Supervisory Meeting Records

| Date | Topics discussed | Actions agreed |
|------|------------------|----------------|
| *[dd/mm/yyyy]* | | |

### Appendix G — Other Supporting Materials

Admin API documentation (`backend/docs/ADMIN_API.md`); manual test notes where present under `backend/docs/` and `admin dashboard rideguide/docs/`; environment example files.

---

### Note on word count (8,000–10,000 main body, PUSL3190)

After importing into Microsoft Word, select **§1 Introduction through §9 Conclusions** only and run **Word Count**. If the count is **below 8,000**, expand **§3** with additional peer-reviewed citations, **§6** with further screenshot cross-references and interface detail, **§7** with tables from live `npm test` output, and **§8** with a short risk–mitigation matrix. Do **not** paste large code blocks—describe behaviour and cite file paths instead.
