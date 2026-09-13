from fastapi import FastAPI
from app.api.clients import router as clients_router
from app.api.requests import router as requests_router
from app.api.quotes import router as quotes_router
from app.api.invoices import router as invoices_router
from app.api.payments import router as payments_router
from app.api.reminders import router as reminders_router
from app.api.credit_notes import router as credit_notes_router
from fastapi.middleware.cors import CORSMiddleware
from app.api.refunds import router as refunds_router
from app.api.coreflow import router as coreflow_router
from app.api.purchase_orders import router as purchase_orders_router
from app.api.proformas import router as proformas_router
from app.api.operational_documents import router as operational_documents_router
from app.api.receipts import router as receipts_router
from app.api.recurring_invoices import router as recurring_invoices_router
from app.api.document_emails import router as document_emails_router
from app.api.history import router as history_router
from app.api.intelligence import router as intelligence_router
from app.api.automations import router as automations_router
from app.api.copilot import router as copilot_router

app = FastAPI(
    title="DevisFlow API",
    version="0.1.0",
    description="API métier de DevisFlow",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(clients_router)
app.include_router(requests_router)
app.include_router(quotes_router)
app.include_router(invoices_router)
app.include_router(payments_router)
app.include_router(reminders_router)
app.include_router(credit_notes_router)
app.include_router(refunds_router)
app.include_router(coreflow_router)
app.include_router(purchase_orders_router)
app.include_router(proformas_router)
app.include_router(operational_documents_router)
app.include_router(receipts_router)
app.include_router(recurring_invoices_router)
app.include_router(document_emails_router)
app.include_router(history_router)
app.include_router(intelligence_router)
app.include_router(automations_router)
app.include_router(copilot_router)


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "devisflow",
        "version": "0.1.0",
    }
