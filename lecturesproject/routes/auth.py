from fastapi import APIRouter, Depends, Form, Request, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from starlette.status import HTTP_303_SEE_OTHER
from sqlalchemy.orm import Session

from lecturesproject.database import get_db
from lecturesproject.schemas import UserCreate
from lecturesproject.jwt_utils import create_access_token
from lecturesproject.dependencies import get_current_lecturer
from lecturesproject.services import user_service

router = APIRouter()
templates = Jinja2Templates(directory="templates")

@router.get("/signup", response_class=HTMLResponse
)
def show_signup_form(request: Request):
    return templates.TemplateResponse("signup.html", {"request": request})

@router.post("/signup", response_class=HTMLResponse)
async def signup_form(
    request: Request,
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    user_data = UserCreate(
        username=email.split("@")[0],
        email=email,
        password=password,
        role="lecturer",
        full_name=""
    )

    try:
        user_service.create_user(user_data, db)
    except ValueError:
        return templates.TemplateResponse("signup.html", {
            "request": request,
            "error": "Email already registered"
        })

    return RedirectResponse(url="/login", status_code=HTTP_303_SEE_OTHER)

@router.get("/login", response_class=HTMLResponse)
def show_login_form(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

@router.post("/login", response_class=HTMLResponse)
async def login_form(
    request: Request,
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    user = user_service.get_user_by_email(email, db)

    if not user or not user_service.verify_user_password(user, password):
        return templates.TemplateResponse("login.html", {
            "request": request,
            "error": "Invalid credentials"
        })

    if user.role != "lecturer":
        return templates.TemplateResponse("login.html", {
            "request": request,
            "error": "Access restricted to lecturers only"
        })

    token = create_access_token({"sub": user.email, "role": user.role})
    response = RedirectResponse(url="/secure-dashboard", status_code=HTTP_303_SEE_OTHER)
    response.set_cookie(key="access_token", value=token, httponly=True)
    return response

@router.get("/secure-dashboard", response_class=HTMLResponse)
def secure_dashboard(request: Request, user=Depends(get_current_lecturer)):
    return templates.TemplateResponse("dashboard.html", {
        "request": request,
        "user": user
    })
