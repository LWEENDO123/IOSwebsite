from fastapi import FastAPI
from pydantic import BaseModel
from datetime import datetime
import time
import threading
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

reminders = []


class Reminder(BaseModel):
    date: str  # Format: "YYYY-MM-DD HH:MM"
    university: str
    class_number: str

@app.post("/add-reminder")
def add_reminder(reminder: Reminder):
    reminders.append({
        "date": reminder.date,
        "university": reminder.university,
        "class_number": reminder.class_number,
        "notified": False
    })
    return {"message": "Reminder added successfully"}

@app.get("/list-reminders")
def list_reminders():
    return {"reminders": reminders}

def send_notification(reminder):
    print(f"🔔 Reminder: Class {reminder['class_number']} at {reminder['university']} is starting now!")

def reminder_checker():
    while True:
        now = datetime.now().strftime("%Y-%m-%d %H:%M")
        for reminder in reminders:
            if reminder["date"] == now and not reminder["notified"]:
                send_notification(reminder)
                reminder["notified"] = True
        time.sleep(30)

threading.Thread(target=reminder_checker, daemon=True).start()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Or specify ["htvtp://localhost:5500"] if you're serving HTML from a local server
    allow_credentials=True,
    allow_methods=["*"],  # Allows GET, POST, OPTIONS, etc.
    allow_headers=["*"],  # Allows Content-Type, Authorization, etc.
)
