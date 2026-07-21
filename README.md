# PROVENDIX — Frontend

Interface web de gestion de la provenderie, développée avec Next.js, React,
TypeScript et Tailwind CSS.

## Prérequis

- Node.js 20.9 ou plus récent
- API PROVENDIX démarrée (par défaut sur `http://localhost:8000`)

## Installation

```bash
npm ci
copy .env.example .env.local
npm run dev
```

L'application est ensuite disponible sur `http://localhost:3000`.

La variable `NEXT_PUBLIC_API_URL` doit contenir l'URL publique de l'API, avec
le suffixe `/api` et sans barre oblique finale.

## Authentification

Le navigateur ne stocke aucun jeton d'accès dans `localStorage`. L'API utilise
des cookies `HttpOnly`; les requêtes d'écriture incluent automatiquement le
jeton CSRF. Le frontend et l'API doivent donc avoir des origines et paramètres
de cookies cohérents en production.

## Vérifications

```bash
npm run lint
npx tsc --noEmit
npm run build
npm audit --omit=dev
```

La devise est stockée sous son code ISO (`XAF` ou `XOF`) et affichée `FCFA`.
Consulter le `README.md` racine et `DEPLOIEMENT.md` pour l'installation complète.
