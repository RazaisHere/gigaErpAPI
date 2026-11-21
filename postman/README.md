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

## Suggested smoke order

1. Health check / probe  
2. Login — Superadmin → Me → Admin ping  
3. Organization → List departments / members / handoff rules  
4. Cases → List / create / illegal 422 / handoff  
5. Clients → List / verifications / 360 / verify  
6. Login — Ayesha → List members (CCS only) → Case detail seed FIN (403)  
7. Login — Client → Admin ping (expect 403)  

Facial recognition and client self-signup + SMTP OTP are **not** in these phases yet.

### Cognito (optional)

Default `AUTH_PROVIDER=nest` keeps local JWTs. To cut over:

1. Create a Cognito user pool + app client with `ALLOW_ADMIN_USER_PASSWORD_AUTH` (and email as username/alias).
2. Fill `COGNITO_*` + AWS credentials in `.env`.
3. Run `npm run cognito:sync` (provisions seed users with permanent `Workspace@123`, writes `cognito_sub`).
4. Set `AUTH_PROVIDER=cognito`, restart the API.
5. Login responses return Cognito `accessToken` / `refreshToken` (use the Cognito Auth folder requests for refresh / forgot / complete-new-password).

Avoid **Change password — Hamza** unless you intend to mutate the seed user (or restore the hash afterwards).

## Keeping this updated

Each backend phase should update:

- the importable JSON (`Giga Workspace API.postman_collection.json`)
- the git-native tree under `collections/giga-workspace-api/`
- `environments/local.environment.yaml` if new variables are needed
