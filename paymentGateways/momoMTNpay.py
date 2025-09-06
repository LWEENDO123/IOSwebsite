from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from uuid import uuid4
from datetime import datetime
import httpx
import firebase_admin
from firebase_admin import credentials, firestore

# Initialize Firestore
cred = credentials.Certificate("firebase-creds.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

app = FastAPI()

# MoMo credentials
MOMO_BASE_URL = "https://sandbox.momodeveloper.mtn.com"
SUBSCRIPTION_KEY = "your-subscription-key"
TARGET_ENV = "sandbox"

# Pydantic model
class UpgradeRequest(BaseModel):
    userId: str
    phone: str
    amount: str

# Token generator (assumes you’ve implemented this)
async def get_momo_token():
    # Return bearer token string
    ...

@app.post("/upgrade")
async def upgrade_user(data: UpgradeRequest):
    reference_id = str(uuid4())
    token = await get_momo_token()

    payload = {
        "amount": data.amount,
        "currency": "ZMW",
        "externalId": data.userId,
        "payer": {
            "partyIdType": "MSISDN",
            "partyId": data.phone
        },
        "payerMessage": "Upgrade to Premium",
        "payeeNote": "Tutoring Platform"
    }

    headers = {
        "Authorization": f"Bearer {token}",
        "X-Reference-Id": reference_id,
        "X-Target-Environment": TARGET_ENV,
        "Ocp-Apim-Subscription-Key": SUBSCRIPTION_KEY,
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient() as client:
        res = await client.post(f"{MOMO_BASE_URL}/collection/v1_0/requesttopay", json=payload, headers=headers)

    if res.status_code != 202:
        raise HTTPException(status_code=500, detail="MoMo request failed")

    # Store in Firestore
    db.collection("payments").document(reference_id).set({
        "userId": data.userId,
        "phone": data.phone,
        "amount": data.amount,
        "currency": "ZMW",
        "referenceId": reference_id,
        "status": "PENDING",
        "createdAt": datetime.utcnow().isoformat()
    })

    return {"referenceId": reference_id, "status": "PENDING"}

@app.get("/payment-status/{reference_id}")
async def check_payment_status(reference_id: str):
    token = await get_momo_token()

    headers = {
        "Authorization": f"Bearer {token}",
        "X-Target-Environment": TARGET_ENV,
        "Ocp-Apim-Subscription-Key": SUBSCRIPTION_KEY
    }

    async with httpx.AsyncClient() as client:
        res = await client.get(f"{MOMO_BASE_URL}/collection/v1_0/requesttopay/{reference_id}", headers=headers)

    if res.status_code != 200:
        raise HTTPException(status_code=500, detail="Failed to fetch payment status")

    momo_status = res.json().get("status")

    # Update Firestore
    db.collection("payments").document(reference_id).update({
        "status": momo_status,
        "checkedAt": datetime.utcnow().isoformat()
    })

    # Optional: upgrade user if successful
    if momo_status == "SUCCESSFUL":
        db.collection("users").document(res.json()["externalId"]).update({
            "premium": True,
            "upgradedAt": datetime.utcnow().isoformat()
        })

    return {"referenceId": reference_id, "status": momo_status}
