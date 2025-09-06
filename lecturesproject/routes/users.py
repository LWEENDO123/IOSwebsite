from fastapi import APIRouter, Depends, HTTPException
from starlette.status import HTTP_303_SEE_OTHER
from starlette.responses import RedirectResponse
from sqlalchemy.orm import Session

from lecturesproject.schemas import UserCreate
from lecturesproject.database import get_db
from lecturesproject.services import user_service

router = APIRouter()

@router.post("/signup")
def signup(user_data: UserCreate, db: Session = Depends(get_db)):
    try:
        user_service.create_user(user_data, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return RedirectResponse(url="/login-ui", status_code=HTTP_303_SEE_OTHER)
