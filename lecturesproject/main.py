from fastapi import FastAPI, Request, Form, Depends, HTTPException, Header, Cookie
from fastapi.responses import HTMLResponse, RedirectResponse, FileResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from sqlalchemy import func
from itsdangerous import URLSafeTimedSerializer
from typing import Optional, Dict, Any
from fastapi import Response
from lecturesproject.auth_utils import hash_password, verify_password  # reuse existing
from lecturesproject.models import User

import os
import re
import io
import pandas as pd
import qrcode

# ----- Your local modules -----
from lecturesproject.models import Student, StudentScore, User, Base
from lecturesproject.database import get_db, engine
from lecturesproject.jwt_utils import decode_access_token, create_access_token
# If you have auth and users routers, keep them included (optional)
# from lecturesproject.routes import auth, users
from fastapi.responses import RedirectResponse
from fastapi.requests import Request
from fastapi import status

# ========= CONFIG =========
APP_HOST =  os.getenv("APP_HOST", "http://localhost:8000") # <<< Put your public host here
TOKEN_SECRET = "YOUR_SECRET_KEY"     # <<< use env var in prod
TOKEN_MAX_AGE_SECONDS = 60 * 60 * 2  # 2 hours

# ========= APP / TEMPLATES =========
app = FastAPI()
templates = Jinja2Templates(directory=os.path.join(os.path.dirname(__file__), "templates"))

# If you have extra routers, keep them:
# app.include_router(auth.router, prefix="/auth")
# app.include_router(users.router, prefix="/api/users")


# ========= HELPERS / AUTH =========
def validate_input(value: str, field_name: str):
    if not (2 <= len(value) <= 25):
        raise HTTPException(status_code=422, detail=f"{field_name} must be between 2 and 25 characters")
    if re.search(r'[!*/\\\-]', value):
        raise HTTPException(status_code=422, detail=f"{field_name} contains invalid symbols")
    return value

def get_current_lecturer_from_header(authorization: str = Header(...)) -> Dict[str, Any]:
    """
    Extract current user from Authorization: Bearer <token> header.
    Enforces role == lecturer.
    """
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")

    token = authorization.split(" ", 1)[1].strip()
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    if payload.get("role") != "lecturer":
        raise HTTPException(status_code=403, detail="Lecturer access required")

    # Must include lecturer id in token payload
    if "id" not in payload:
        raise HTTPException(status_code=401, detail="Token missing user id")

    return payload

def get_current_lecturer_cookie(access_token: Optional[str] = Cookie(None)) -> Dict[str, Any]:
    """
    Same as above, but read token from cookie named 'access_token'.
    """
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = decode_access_token(access_token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    if payload.get("role") != "lecturer":
        raise HTTPException(status_code=403, detail="Lecturer access required")
    if "id" not in payload:
        raise HTTPException(status_code=401, detail="Token missing user id")

    return payload

# Choose ONE of these as your default dependency. Using cookie here to match your earlier code:
get_current_lecturer = get_current_lecturer_cookie

# Token serializer for public submit links
serializer = URLSafeTimedSerializer(TOKEN_SECRET)




@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    if exc.status_code in [401, 403,]:
        return RedirectResponse(url="/login", status_code=status.HTTP_303_SEE_OTHER)
    return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)



# ========= BASIC PAGES =========
@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    return templates.TemplateResponse("home.html", {"request": request})


# ========= DB MANAGEMENT =========
@app.post("/create-database")
def create_database():
    Base.metadata.create_all(bind=engine)
    return {"message": "✅ Database ready"}


# ========= STUDENT ADD UI =========
@app.get("/add-student-ui", response_class=HTMLResponse)
def show_student_form(request: Request, current_user: Dict[str, Any] = Depends(get_current_lecturer)):
    return templates.TemplateResponse("add_student.html", {"request": request})


# ========= ADD STUDENT =========
@app.post("/add-student")
def add_student(
    university: str = Form(...),
    module: str = Form(...),
    name: str = Form(...),
    student_id: str = Form(...),
    class_type: str = Form(...),
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_lecturer)
):
    lecturer_id = current_user["id"]

    # Optional: Input validation
    university = validate_input(university, "University")
    module = validate_input(module, "Module")
    name = validate_input(name, "Name")
    student_id = validate_input(student_id, "Student ID")
    class_type = validate_input(class_type, "Class Type")

    # Duplicate check scoped to lecturer (case-insensitive)
    existing = (
        db.query(Student)
        .filter(
            Student.lecturer_id == lecturer_id,
            func.lower(Student.student_id) == student_id.lower(),
            func.lower(Student.university) == university.lower(),
            func.lower(Student.module) == module.lower(),
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Student already exists")

    new_student = Student(
        lecturer_id=lecturer_id,
        university=university,
        module=module,
        name=name,
        student_id=student_id,
        class_type=class_type
    )
    db.add(new_student)
    db.commit()
    return RedirectResponse("/add-student-ui", status_code=303)


# ========= STUDENTS DASHBOARD (unscored + scored) =========
@app.get("/students-dashboard", response_class=HTMLResponse)
def students_dashboard(
    request: Request,
    university: str = "",
    module: str = "",
    class_type: str = "",
    score_university: str = "",
    score_module: str = "",
    score_class_type: str = "",
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_lecturer),
):
    lecturer_id = current_user["id"]

    # ---- Unscored students ----
    student_query = db.query(Student).filter(Student.lecturer_id == lecturer_id)

    if university:
        student_query = student_query.filter(func.lower(Student.university) == university.lower())
    if module:
        student_query = student_query.filter(func.lower(Student.module) == module.lower())
    if class_type:
        student_query = student_query.filter(func.lower(Student.class_type) == class_type.lower())

    all_students = student_query.all()

    # Already scored ids for this lecturer
    scored_ids = set(
        s[0].lower()
        for s in db.query(StudentScore.student_id)
                   .filter(StudentScore.lecturer_id == lecturer_id)
                   .distinct()
                   .all()
    )
    unscored_students = [s for s in all_students if s.student_id.lower() not in scored_ids]

    # ---- Scored students ----
    score_query = db.query(StudentScore).filter(StudentScore.lecturer_id == lecturer_id)
    if score_university:
        score_query = score_query.filter(func.lower(StudentScore.university) == score_university.lower())
    if score_module:
        score_query = score_query.filter(func.lower(StudentScore.module) == score_module.lower())
    if score_class_type:
        score_query = score_query.filter(func.lower(StudentScore.class_type) == score_class_type.lower())
    scored_students = score_query.all()

    return templates.TemplateResponse("students_dashboard.html", {
        "request": request,
        "students": unscored_students,
        "scored_students": scored_students,
        "university": university,
        "module": module,
        "class_type": class_type,
        "score_university": score_university,
        "score_module": score_module,
        "score_class_type": score_class_type
    })


# ========= SUBMIT SINGLE SCORE (from first table rows) =========
@app.post("/update-scores")
async def update_scores(request: Request, db: Session = Depends(get_db), current_user: Dict[str, Any] = Depends(get_current_lecturer)):
    lecturer_id = current_user["id"]
    form = await request.form()

    # If specific "add_single" is present, we only process that one
    add_single_id = form.get("add_single")

    # batch or single
    for key, value in form.items():
        if key.startswith("mark_") and value.strip():
            sid = key.replace("mark_", "")
            if add_single_id and sid != add_single_id:
                continue  # skip others if single add

            try:
                mark = float(value)
            except ValueError:
                continue

            name = form.get(f"name_{sid}")
            student_id = form.get(f"student_id_{sid}", sid)
            university = form.get(f"university_{sid}")
            module = form.get(f"module_{sid}")
            class_type = form.get(f"class_type_{sid}")

            # Confirm the student belongs to this lecturer
            owner = (
                db.query(Student)
                .filter(
                    Student.lecturer_id == lecturer_id,
                    func.lower(Student.student_id) == student_id.lower(),
                )
                .first()
            )
            if not owner:
                # Ignore silently for security (or raise 403)
                continue

            # Upsert score
            score = (
                db.query(StudentScore)
                .filter(
                    StudentScore.lecturer_id == lecturer_id,
                    func.lower(StudentScore.student_id) == student_id.lower(),
                    func.lower(StudentScore.module) == module.lower(),
                )
                .first()
            )
            if score:
                score.mark = mark
                score.name = name
                score.university = university
                score.class_type = class_type
            else:
                db.add(StudentScore(
                    lecturer_id=lecturer_id,
                    student_id=student_id,
                    name=name,
                    university=university,
                    module=module,
                    class_type=class_type,
                    mark=mark
                ))

    db.commit()
    return RedirectResponse("/students-dashboard", status_code=303)


# ========= DELETE SCORES (second table) =========
@app.post("/delete-scores")
async def delete_scores(request: Request, db: Session = Depends(get_db), current_user: Dict[str, Any] = Depends(get_current_lecturer)):
    lecturer_id = current_user["id"]
    form = await request.form()
    delete_ids = form.getlist("delete_ids")

    for student_id in delete_ids:
        score = (
            db.query(StudentScore)
            .filter(
                StudentScore.lecturer_id == lecturer_id,
                func.lower(StudentScore.student_id) == student_id.lower()
            )
            .first()
        )
        if score:
            db.delete(score)

    db.commit()
    # Keep filters after delete if provided
    university = form.get("university", "")
    module = form.get("module", "")
    class_type = form.get("class_type", "")
    redirect_url = f"/students-dashboard?score_university={university}&score_module={module}&score_class_type={class_type}"
    return RedirectResponse(redirect_url, status_code=303)


# ========= DELETE STUDENTS (first table) =========
@app.post("/delete-students")
async def delete_students(request: Request, db: Session = Depends(get_db), current_user: Dict[str, Any] = Depends(get_current_lecturer)):
    lecturer_id = current_user["id"]
    form = await request.form()
    delete_ids = form.getlist("delete_ids")

    for student_id in delete_ids:
        student = (
            db.query(Student)
            .filter(
                Student.lecturer_id == lecturer_id,
                func.lower(Student.student_id) == student_id.lower()
            )
            .first()
        )
        if student:
            db.delete(student)

        # Also remove any scores for this student for this lecturer
        db.query(StudentScore).filter(
            StudentScore.lecturer_id == lecturer_id,
            func.lower(StudentScore.student_id) == student_id.lower()
        ).delete()

    db.commit()
    return RedirectResponse("/students-dashboard", status_code=303)


# ========= GET STUDENTS (kept for add_student page filter form) =========
@app.get("/get-students", response_class=HTMLResponse)
def get_students(
    request: Request,
    university: str = "",
    module: str = "",
    class_type: str = "",
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_lecturer)
):
    lecturer_id = current_user["id"]

    query = db.query(Student).filter(Student.lecturer_id == lecturer_id)
    if university:
        query = query.filter(func.lower(Student.university) == university.lower())
    if module:
        query = query.filter(func.lower(Student.module) == module.lower())
    if class_type:
        query = query.filter(func.lower(Student.class_type) == class_type.lower())
    students = query.all()

    return templates.TemplateResponse("add_student.html", {
        "request": request,
        "students": students,
        "university": university,
        "module": module,
        "class_type": class_type
    })


# ========= MODULES FOR DROPDOWN (scoped to lecturer) =========
@app.get("/api/modules")
def get_modules(db: Session = Depends(get_db), current_user: Dict[str, Any] = Depends(get_current_lecturer)):
    lecturer_id = current_user["id"]
    modules = (
        db.query(Student.module)
        .filter(Student.lecturer_id == lecturer_id)
        .distinct()
        .all()
    )
    return [m[0] for m in modules if m[0]]


# ========= SCORE ANALYTICS =========
@app.get("/score-analytics-ui", response_class=HTMLResponse)
def score_analytics_ui(
    request: Request,
    university: str = "",
    module: str = "",
    class_type: str = "",
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_lecturer)
):
    lecturer_id = current_user["id"]

    query = db.query(StudentScore).filter(StudentScore.lecturer_id == lecturer_id)

    if university:
        query = query.filter(func.lower(StudentScore.university) == university.lower())
    if module:
        query = query.filter(func.lower(StudentScore.module) == module.lower())
    if class_type:
        query = query.filter(func.lower(StudentScore.class_type) == class_type.lower())

    scores = query.all()

    # Dropdown lists
    universities = [u[0] for u in db.query(StudentScore.university).filter(StudentScore.lecturer_id == lecturer_id).distinct().all()]
    modules = [m[0] for m in db.query(StudentScore.module).filter(StudentScore.lecturer_id == lecturer_id).distinct().all()]
    class_types = [c[0] for c in db.query(StudentScore.class_type).filter(StudentScore.lecturer_id == lecturer_id).distinct().all()]

    if not scores:
        return templates.TemplateResponse("score_analytics.html", {
            "request": request,
            "message": "No scores available",
            "universities": universities,
            "modules": modules,
            "class_types": class_types,
            "university": university,
            "module": module,
            "class_type": class_type
        })

    marks = [s.mark for s in scores]
    average = sum(marks) / len(marks)

    ranges = [(40, 55), (55, 65), (65, 75), (75, 85), (85, 100)]
    range_results = {}
    for low, high in ranges:
        filtered = [s for s in scores if low <= s.mark <= high]
        range_results[f"{low}-{high}"] = filtered

    return templates.TemplateResponse("score_analytics.html", {
        "request": request,
        "average": average,
        "score_ranges": range_results,
        "universities": universities,
        "modules": modules,
        "class_types": class_types,
        "university": university,
        "module": module,
        "class_type": class_type
    })



# ========= EXCEL EXPORT (scores) =========
@app.get("/download-scores-excel")
def download_scores_excel(
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_lecturer)
):
    lecturer_id = current_user["id"]
    scores = db.query(StudentScore).filter(StudentScore.lecturer_id == lecturer_id).all()
    if not scores:
        raise HTTPException(status_code=404, detail="No scores available")

    data = [{
        "Student ID": s.student_id,
        "Name": s.name,
        "University": s.university,
        "Module": s.module,
        "Class Type": s.class_type,
        "Mark": s.mark
    } for s in scores]

    df = pd.DataFrame(data)

    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Scores")
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=student_scores.xlsx"}
    )


# ========= PUBLIC REGISTRATION (token link) =========
def generate_submission_token(lecturer_id: int) -> str:
    return serializer.dumps({"lecturer_id": lecturer_id})

def validate_submission_token(token: str) -> int:
    try:
        data = serializer.loads(token, max_age=TOKEN_MAX_AGE_SECONDS)
        return int(data["lecturer_id"])
    except Exception:
        raise HTTPException(status_code=403, detail="Submission link expired or invalid")


@app.get("/register-student/{token}", response_class=HTMLResponse)
def public_student_form(request: Request, token: str):
    # No auth here; public page
    return templates.TemplateResponse("add_student_public.html", {"request": request, "token": token})


@app.post("/submit-student/{token}")
def submit_student_with_token(
    token: str,
    university: str = Form(...),
    module: str = Form(...),
    name: str = Form(...),
    student_id: str = Form(...),
    class_type: str = Form(...),
    db: Session = Depends(get_db)
):
    lecturer_id = validate_submission_token(token)

    # Validate inputs
    university = validate_input(university, "University")
    module = validate_input(module, "Module")
    name = validate_input(name, "Name")
    student_id = validate_input(student_id, "Student ID")
    class_type = validate_input(class_type, "Class Type")

    # Duplicate check (per lecturer, case-insensitive)
    existing = (
        db.query(Student)
        .filter(
            Student.lecturer_id == lecturer_id,
            func.lower(Student.student_id) == student_id.lower(),
            func.lower(Student.university) == university.lower(),
            func.lower(Student.module) == module.lower()
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Student already exists")

    db.add(Student(
        lecturer_id=lecturer_id,
        university=university,
        module=module,
        name=name,
        student_id=student_id,
        class_type=class_type
    ))
    db.commit()
    # Redirect to a "thank you" or back to public form
    return RedirectResponse(f"/register-student/{token}", status_code=303)


# ========= LINK + QR GENERATION =========
@app.get("/generate-register-link")
def generate_register_link(current_user: Dict[str, Any] = Depends(get_current_lecturer)):
    """
    Returns a JSON with a secure registration link for the current lecturer.
    """
    lecturer_id = current_user["id"]
    token = generate_submission_token(lecturer_id)
    link = f"{APP_HOST}/register-student/{token}"
    return {"link": link, "token_expires_in_seconds": TOKEN_MAX_AGE_SECONDS}


from fastapi.responses import StreamingResponse

@app.get("/qr/register-link")
def qr_register_link(current_user: Dict[str, Any] = Depends(get_current_lecturer)):
    lecturer_id = current_user["id"]
    token = generate_submission_token(lecturer_id)
    link = f"{APP_HOST}/register-student/{token}"

    img = qrcode.make(link)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    return StreamingResponse(buf, media_type="image/png", headers={
        "Content-Disposition": "attachment; filename=register_qr.png"
    })


# ================= AUTH: Signup / Login / Logout =================

@app.get("/signup", response_class=HTMLResponse)
def signup_form(request: Request):
    return templates.TemplateResponse("signup.html", {"request": request})


@app.post("/signup")
def signup(
    username: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    full_name: str = Form(""),
    db: Session = Depends(get_db)
):
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        username=username,
        email=email,
        password_hash=hash_password(password),
        role="lecturer",
        full_name=full_name
    )
    db.add(user)
    db.commit()
    return RedirectResponse("/login", status_code=303)


@app.get("/login", response_class=HTMLResponse)
def login_form(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})


@app.post("/login", response_class=HTMLResponse)
def login(
    request: Request,
    response: Response,
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == email).first()

    if not user or not verify_password(password, user.password_hash):
        # Instead of raising HTTPException, re-render login.html with error message
        return templates.TemplateResponse(
            "login.html",
            {
                "request": request,
                "error": "Invalid email or password"
            },
            status_code=400
        )

    token = create_access_token({"id": user.id, "role": user.role})
    resp = RedirectResponse("/", status_code=303)
    resp.set_cookie("access_token", token, httponly=True, secure=False)  # secure=True in prod
    return resp



@app.get("/logout")
def logout():
    resp = RedirectResponse("/login", status_code=303)
    resp.delete_cookie("access_token")
    return resp



import random, time
from lecturesproject.models import PasswordResetCode

# ========== Forgot Password ==========
@app.get("/forgot-password", response_class=HTMLResponse)
def forgot_password_form(request: Request):
    return templates.TemplateResponse("forgot_password.html", {"request": request})


@app.post("/forgot-password")
def forgot_password(email: str = Form(...), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=400, detail="Email not found")

    # Generate 6-digit code
    code = str(random.randint(100000, 999999))
    expires = int(time.time()) + 600  # valid for 10 minutes

    # Save to DB
    reset = PasswordResetCode(email=email, code=code, expires_at=expires)
    db.add(reset)
    db.commit()

    # Send email
    send_email(email, "Password Reset Code", f"Your reset code is: {code}\nValid for 10 minutes.")

    return RedirectResponse("/reset-password", status_code=303)


# ========== Reset Password ==========
@app.get("/reset-password", response_class=HTMLResponse)
def reset_password_form(request: Request):
    return templates.TemplateResponse("reset_password.html", {"request": request})


@app.post("/reset-password")
def reset_password(
    email: str = Form(...),
    code: str = Form(...),
    new_password: str = Form(...),
    db: Session = Depends(get_db),
):
    reset = (
        db.query(PasswordResetCode)
        .filter(PasswordResetCode.email == email, PasswordResetCode.code == code)
        .order_by(PasswordResetCode.id.desc())
        .first()
    )

    if not reset or reset.expires_at < int(time.time()):
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    # Update user password
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=400, detail="User not found")

    user.password_hash = hash_password(new_password)
    db.delete(reset)
    db.commit()

    return RedirectResponse("/login", status_code=303)

