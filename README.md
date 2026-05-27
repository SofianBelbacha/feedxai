# FeedXAi

FeedXAi est une plateforme SaaS moderne de collecte, centralisation et analyse intelligente de feedback client.

## Objectif

Permettre aux entreprises de :

* Collecter du feedback via widget embarqué
* Centraliser les retours clients par projet
* Utiliser l’IA pour analyser automatiquement :

  * Catégorie
  * Priorité
  * Résumé
* Suivre l’évolution des retours via dashboard
* Gérer plusieurs projets selon le plan utilisateur

---

# Architecture

Le projet suit une **Clean Architecture** avec séparation stricte des responsabilités.

```txt
AiReviewHub/
├── AiReviewHub.Domain/           # Entités métier + logique métier
├── AiReviewHub.Application/      # Use cases, Commands, Queries, DTOs
├── AiReviewHub.Infrastructure/   # EF Core, OpenAI, Hangfire, Persistence
├── AiReviewHub.API/              # Endpoints REST API
├── frontend/                     # Angular dashboard + widget
└── tests/                        # Tests unitaires & intégration
```

---

# Stack Technique

## Backend

* **ASP.NET Core 9**
* **Entity Framework Core**
* **PostgreSQL**
* **MediatR**
* **FluentValidation**
* **Hangfire** (jobs background)
* **OpenAI API** (`gpt-4.1-mini`, `gpt-5-mini`)
* **Docker**

## Frontend

* **Angular**
* **Signals API**
* **SCSS**
* **Responsive dashboard UI**

## Tests

* **xUnit**
* **FluentAssertions**
* **Moq**
* **Vitest / Angular Testing Library**

---

# Fonctionnalités principales

## Authentification

* Inscription / connexion
* Google OAuth
* JWT + cookies sécurisés

## Gestion projets

* Création
* Désactivation
* Régénération de token public
* Limites selon abonnement :

  * Free : 1 projet
  * Pro : 10 projets
  * Team : illimité

## Widget public

* Intégration via script externe
* Token sécurisé
* Collecte de feedback sans authentification

## Analyse IA

* Classification automatique
* Priorisation
* Résumé
* Traitement asynchrone avec Hangfire

## Dashboard

* Vue globale
* Nombre de feedbacks
* Projets actifs
* Statistiques IA

---

# Sécurité

* Tokens publics isolés par projet
* JWT HttpOnly
* Validation FluentValidation
* CORS contrôlé
* HTTPS obligatoire
* Rate limiting recommandé

---

# Roadmap

## MVP

* [x] Auth
* [x] Projects
* [x] Feedback
* [x] AI Analysis
* [x] Dashboard
* [ ] Billing Stripe
* [ ] Notifications email
* [x] Export CSV
* [ ] Multi-language widget

---

# 🧠 Exemple d’intégration widget

```html
<script src="https://widget.aireviewhub.com/widget.js"></script>
<ai-reviewhub-widget token="PUBLIC_TOKEN"></ai-reviewhub-widget>
```

---

# Contribution

## Standards :

* Clean Architecture
* SOLID
* CQRS
* Tests obligatoires
* Conventional commits

### Branch naming :

```txt
feature/project-dashboard
fix/utc-datetime
refactor/openai-service
```

---

# Licence

Propriétaire — Tous droits réservés.

---

# Auteur

Développé par Sofian Belbacha.

---

# Vision

FeedXAi vise à devenir une solution complète de Voice of Customer assistée par IA, simple à intégrer, performante et scalable.
