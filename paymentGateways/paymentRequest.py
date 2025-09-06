import requests
import uuid

access_token = "a9628b04-70bd-4e91-8c0a-598879eaaebf"
subscription_key = "0a9e3fa6eb66406a8553f29d5fc3758d"
reference_id = str(uuid.uuid4())  # Generate unique transaction ID

headers = {
    "Authorization": f"Bearer {access_token}",
    "X-Reference-Id": reference_id,
    "X-Target-Environment": "sandbox",
    "Ocp-Apim-Subscription-Key": subscription_key,
    "Content-Type": "application/json"
}

body = {
    "amount": "100",
    "currency": "ZMW",
    "externalId": "123456",
    "payer": {
        "partyIdType": "MSISDN",
        "partyId": "260960000001"
    },
    "payerMessage": "Payment for tutoring session",
    "payeeNote": "Tutoring fee"
}

url = "https://sandbox.momodeveloper.mtn.com/collection/v1_0/requesttopay"
response = requests.post(url, headers=headers, json=body)

print("Status Code:", response.status_code)
print("Response:", response.text)
