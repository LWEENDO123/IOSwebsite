import requests
import base64

# Replace these with your actual credentials
api_user = "a9628b04-70bd-4e91-8c0a-598879eaaebf"
api_key = "b98c014dd13b4e38abef810860ef22de"
subscription_key = "0a9e3fa6eb66406a8553f29d5fc3758d"

# Encode credentials in Base64
credentials = f"{api_user}:{api_key}"
encoded_credentials = base64.b64encode(credentials.encode()).decode()

# Set headers
headers = {
    "Authorization": f"Basic {encoded_credentials}",
    "Ocp-Apim-Subscription-Key": subscription_key
}

# Send POST request
url = "https://sandbox.momodeveloper.mtn.com/collection/token/"
response = requests.post(url, headers=headers)

# Print response
print("Status Code:", response.status_code)
print("Response:", response.text)
