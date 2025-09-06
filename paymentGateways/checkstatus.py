import requests

access_token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSMjU2In0.eyJjbGllbnRJZCI6ImE5NjI4YjA0LTcwYmQtNGU5MS04YzBhLTU5ODg3OWVhYWViZiIsImV4cGlyZXMiOiIyMDI1LTA4LTIwVDE0OjM0OjAzLjg4NiIsInNlc3Npb25JZCI6IjdlOTU1Y2Y4LTNkYzMtNGQ5ZC1iMmJhLTRkYmI0MjUyNDZmNCJ9.l1AP539AEMfFo80n-n0v50CHMHvIqw1IRA_PKPTLhQfbUkdJlb9r1zkNbZXCaRouEf14JbQvTy-hHcNntCcWtTUjMGIvo2aFWUcZeDhTd-hHTGGBBaw5FV7CcR0HE_vi7xlXOGbHDVkgEcxjuENKyf42TsEni1gvM36uRE2nK53cya7eMQL5zLCnCY3LiLNrIv7yFV-Sbxzp_YhcQf7XjJsbUcIH90CRtyPKdCFP4k2dq5JBDq-SN6md2EEyuAO0fCd7fNNhjVTR1xn6eUk5LLViucX1NmpZmEtGNjslz8OlsWMzVXJ2rNKXtmFJlM9UD8QFZVpW-hWznf13Kt_k5Q"
subscription_key = "0a9e3fa6eb66406a8553f29d5fc3758d"
reference_id = "a9628b04-70bd-4e91-8c0a-598879eaaebf"

headers = {
    "Authorization": f"Bearer {access_token}",
    "X-Target-Environment": "sandbox",
    "Ocp-Apim-Subscription-Key": subscription_key
}

url = f"https://sandbox.momodeveloper.mtn.com/collection/v1_0/requesttopay/{reference_id}"
response = requests.get(url, headers=headers)

print("Status Code:", response.status_code)
print("Response Headers:", response.headers)

# Safe JSON parsing
if response.content and response.headers.get("Content-Type") == "application/json":
    try:
        print("Response JSON:", response.json())
    except ValueError:
        print("Response content is not valid JSON.")
else:
    print("Raw Response Text:", response.text)
