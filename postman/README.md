# Postman — Giga Workspace API

## Quick import (Postman Desktop)

1. Open Postman → **Import**
2. Import both files:
   - `Giga Workspace API.postman_collection.json`
   - `Local.postman_environment.json`
3. Select environment **Giga Workspace — Local**
4. Ensure the API is running: `npm run start:dev`
5. Run **Auth → Login — Superadmin** (saves `accessToken`)
6. Run other requests (Health, Me, Admin ping, …)

Seed password: `Workspace@123`

## Suggested Phase 1 smoke order

1. Health check  
2. Health probe  
3. Login — Superadmin → Me → Admin ping  
4. Login — Hamza → Me — Hamza (expect 403)  
5. Login — Client → Admin ping — Client (expect 403)  

Avoid **Change password — Hamza** unless you intend to mutate the seed user (or restore the hash afterwards).

## Keeping this updated

Each backend phase should update:

- the importable JSON (`Giga Workspace API.postman_collection.json`)
- the git-native tree under `collections/giga-workspace-api/`
- `environments/local.environment.yaml` if new variables are needed
