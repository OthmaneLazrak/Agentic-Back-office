# AWB KYC Spring Backend

Spring Boot replacement for `api_server.py`.

## PostgreSQL

With Docker:

```powershell
docker compose up -d
```

Without Docker, create the database first:

```sql
CREATE DATABASE kyc_db;
```

Default connection:

```text
DB_URL=jdbc:postgresql://localhost:5432/kyc_db
DB_USERNAME=postgres
DB_PASSWORD=postgres
```

You can override these environment variables before running.

## Run

From `kyc-spring-backend`:

```powershell
mvn spring-boot:run
```

The API runs on `http://localhost:8000`, so the existing React frontend can keep using the same `API_BASE`.

The Spring service calls `scripts/kyc_bridge.py`, which reuses the existing Python AI extraction and validation code under `kyc_mcp_server`.
If your AI dependencies are installed only in the project virtualenv, run with:

```powershell
$env:KYC_PYTHON="..\.venv\Scripts\python.exe"
mvn spring-boot:run
```
