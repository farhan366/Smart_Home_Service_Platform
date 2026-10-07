# Smart Home Service Management & Recommendation Platform — Module 1

Identity, service discovery, provider profiling and operational calendar.

## Run the backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # set SECRET_KEY: openssl rand -hex 32
createdb smart_home
alembic revision --autogenerate -m "module 1 schema"
alembic upgrade head
python -m scripts.seed          # catalog + admin (admin@smarthome.com / Admin12345)
uvicorn app.main:app --reload   # docs at http://localhost:8000/docs
```

## Run the frontend
```bash
cd frontend
cp .env.example .env
npm install && npm run dev      # http://localhost:5173
```

## Layout
```
backend/
  app/
    main.py                 app factory, CORS, router registration
    models.py               all SQLAlchemy 2.0 models (Module 1 + Module 2/3 skeletons)
    core/                   config, JWT/bcrypt security, RBAC dependencies
    db/                     Base + timestamp mixin, engine/session
    schemas/                Pydantic v2: auth, address, service, provider, schedule
    routers/                auth, addresses, services, providers
    services/               catalog tree, provider serialisation/uploads, slot generator
  alembic/                  migration environment
  scripts/seed.py           categories + admin
frontend/src/
  api/client.js             Axios instance, token store, refresh-on-401 interceptor
  context/AuthContext.jsx   session, login/register/logout, role helpers
  components/               Navbar, ProtectedRoute, AddressManager, ProviderProfileSetup,
                            AvailabilityEditor, ProviderCard, ui
  pages/                    Login, Register, ServiceDiscovery, ProviderPublicProfile,
                            CustomerAddresses, ProviderDashboard
```

## Extension points for Modules 2 & 3
- `bookings`, `slot_locks`, `reviews`, `service_engagement_logs` tables already exist; the slot generator
  already subtracts active bookings and unexpired locks.
- Module 2: add `quotations`/`payments` tables FK -> `bookings.id`; add `routers/bookings.py`.
- Module 3: a review writer updates `provider_profiles.avg_rating/rating_count`; disputes FK -> `bookings.id`;
  the recommender trains on `service_engagement_logs` + `reviews`.
