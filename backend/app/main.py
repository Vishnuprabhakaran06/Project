from fastapi import FastAPI
from app.database import Base, engine
from fastapi.middleware.cors import CORSMiddleware

from app.models.plan import Plan
from app.models.tenant import Tenant
from app.models.subscription import Subscription 
from app.models.usage_record import UsageRecord
from app.models.user import User
from app.routes.auth_routes import router as auth_router

from app.routes.plan_routes import router as plan_router
from app.routes.tenant_routes import router as tenant_router
from app.routes.subscription_routes import router as subscription_router
from app.routes.usage_routes import router as usage_router
from app.routes.api_routes import router as api_router

Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tenant_router)
app.include_router(plan_router)
app.include_router(subscription_router)
app.include_router(usage_router)
app.include_router(api_router)
app.include_router(auth_router)

@app.get("/")
def root():
    return {"message": "SaaS Billing     API is running"}