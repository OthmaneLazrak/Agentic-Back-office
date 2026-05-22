# Keycloak setup — AWB KYC

## Démarrage rapide

Depuis `kyc-spring-backend/` :

```bash
docker compose up -d
```

Keycloak démarre sur `http://localhost:8080` et importe automatiquement le realm `awb-kyc` depuis `keycloak/awb-kyc-realm.json` au premier démarrage.

- **Console admin Keycloak** : http://localhost:8080  (admin / admin)
- **Realm applicatif** : `awb-kyc`

## Utilisateurs de démo

| Username       | Mot de passe | Rôle          |
|----------------|--------------|---------------|
| admin.kyc      | admin123     | ADMIN         |
| front.officer  | front123     | FRONT_OFFICE  |
| back.officer   | back123      | BACK_OFFICE   |

À utiliser uniquement en dev/recette. À supprimer en prod.

## Clients

- `kyc-frontend` — client public (SPA React), flow Authorization Code + PKCE.
- `kyc-backend` — client confidentiel utilisé par Spring pour valider les JWT et appeler l'Admin API Keycloak (gestion des utilisateurs).

Le secret par défaut du client `kyc-backend` est `kyc-backend-secret-change-me`. **Changer en production** dans `awb-kyc-realm.json` puis dans la variable d'environnement `KEYCLOAK_ADMIN_CLIENT_SECRET` du backend.

## Variables d'environnement utiles

Backend Spring (`application.properties`) :

```
KEYCLOAK_SERVER_URL=http://localhost:8080
KEYCLOAK_REALM=awb-kyc
KEYCLOAK_ADMIN_CLIENT_ID=kyc-backend
KEYCLOAK_ADMIN_CLIENT_SECRET=kyc-backend-secret-change-me
APP_CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174
```

Frontend (`kyc-frontend/.env` à créer si besoin) :

```
VITE_API_BASE=http://localhost:8000
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=awb-kyc
VITE_KEYCLOAK_CLIENT_ID=kyc-frontend
```

## Modifier le realm

Deux options pour faire évoluer la configuration Keycloak :

1. **Via la console admin** (http://localhost:8080) puis exporter le realm pour mettre à jour `awb-kyc-realm.json`.
2. **Éditer directement** `awb-kyc-realm.json` puis recréer le volume (`docker compose down -v && docker compose up -d`).

L'import n'écrase pas un realm existant, sauf si le volume est recréé.
