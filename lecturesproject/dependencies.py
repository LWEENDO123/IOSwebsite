from fastapi import Depends, HTTPException, Header, Cookie
from lecturesproject.jwt_utils import decode_access_token

def get_current_lecturer_from_header(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    payload = decode_access_token(token)

    if not payload or payload.get("role") != "lecturer":
        raise HTTPException(status_code=403, detail="Lecturer access required")

    return payload  # contains {"id": ..., "email": ..., "role": "lecturer"}

def get_current_lecturer(access_token: str = Cookie(None)):
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = decode_access_token(access_token)
    if not payload or payload.get("role") != "lecturer":
        raise HTTPException(status_code=403, detail="Lecturer access required")

    return payload
