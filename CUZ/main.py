import os
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse

app = FastAPI()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Mount static folder (CSS, JS, images)
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")

# Point Jinja2 to a templates folder
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))

@app.get("/", response_class=HTMLResponse)
async def serve_index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/{template_name}", response_class=HTMLResponse)
async def serve_template(request: Request, template_name: str):
    if not template_name.endswith(".html"):
        template_name += ".html"
    return templates.TemplateResponse(template_name, {"request": request})

# Heartbeat / health check
@app.get("/heartbeat")
async def heartbeat():
    return JSONResponse(content={"status": "ok", "message": "Service is running"})

# Explicit favicon route
@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return FileResponse(os.path.join(BASE_DIR, "static", "favicon.ico"))
