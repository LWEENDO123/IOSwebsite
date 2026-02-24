import os
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse

app = FastAPI()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Mounting the static folder
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")

# Pointing Jinja2 to your CUZ folder
templates = Jinja2Templates(directory=BASE_DIR)

@app.get("/", response_class=HTMLResponse)
async def serve_index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

# This handles login.html, signup.html, etc.
@app.get("/{template_name}", response_class=HTMLResponse)
async def serve_template(request: Request, template_name: str):
    if not template_name.endswith(".html"):
        template_name += ".html"
    return templates.TemplateResponse(template_name, {"request": request})


