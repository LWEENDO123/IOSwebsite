from fastapi import FastAPI
from CUZ.USERS import user_routes
from CUZ.core.firebase_config import db  # ✅ Use shared db
from CUZ.HOME.home_routes import router as home_router

app = FastAPI()
app.include_router(user_routes.router)
app.include_router(home_router)
app.include_router(pinned_router)


@app.post("/apply-discount/{student_id}", tags=["Students"])
async def apply_discount(student_id: str, code: str):
    student_ref = db.collection("STUDENTS").document(student_id)
    student_doc = student_ref.get()

    if not student_doc.exists:
        return {"error": "Student not found"}

    student_data = student_doc.to_dict()
    discounts = student_data.get("discounts", [])

    if code in discounts:
        return {
            "message": "This code has already been used.",
            "inbox": discounts
        }

    discounts.append(code)
    student_ref.update({"discounts": discounts})

    return {
        "message": "Discount applied and saved to your inbox.",
        "inbox": discounts
    }
