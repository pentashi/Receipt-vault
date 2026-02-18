# ReceiptVault Docker Compose Workflow

## Prerequisites
- Docker and Docker Compose installed
- (Optional) .env file for secrets (not required for default setup)

## 1. Build and Start All Services

```
docker-compose up --build
```
- This will build and start:
  - PostgreSQL database (db)
  - Flask backend (backend, on port 5000)
  - React frontend (frontend, on port 80)

## 2. Access the App
- Frontend: http://localhost/
- Backend API: http://localhost:5000/api/v1/receipts/

## 3. Stopping Services

```
docker-compose down
```
- This will stop all containers. Data in the database is persisted in the `db_data` Docker volume.

## 4. Common Commands
- Rebuild after code changes:
  ```
  docker-compose up --build
  ```
- View logs:
  ```
  docker-compose logs -f
  ```
- Run a shell in a container:
  ```
  docker-compose exec backend bash
  docker-compose exec db psql -U receiptvault -d receiptvault
  ```

## 5. Environment Variables
- Database connection is set via `DATABASE_URL` in docker-compose.yml.
- For production, set strong secrets and use a managed database.

## 6. Initial Database Migration
- If your backend uses Flask-Migrate or Alembic, run migrations after the first start:
  ```
  docker-compose exec backend flask db upgrade
  ```

---

For any issues, check logs with `docker-compose logs` and ensure all services are healthy.
