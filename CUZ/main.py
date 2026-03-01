import os
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse

app = FastAPI()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Mount static folder (CSS, JS, images)
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")

# Point Jinja2 directly to CUZ (since templates are here)
templates = Jinja2Templates(directory=BASE_DIR)

@app.get("/", response_class=HTMLResponse)
async def serve_index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

# Explicit favicon route FIRST
@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return FileResponse(os.path.join(BASE_DIR, "static", "favicon.ico"))

# Generic template route AFTER
@app.get("/{template_name}", response_class=HTMLResponse)
async def serve_template(request: Request, template_name: str):
    if not template_name.endswith(".html"):
        template_name += ".html"
    return templates.TemplateResponse(template_name, {"request": request})

# Heartbeat / health check
@app.get("/heartbeat")
async def heartbeat():
    return JSONResponse(content={"status": "ok", "message": "Service is running"})

# Debug route to list static files
@app.get("/debug/static")
async def list_static_files():
    static_dir = os.path.join(BASE_DIR, "static")
    file_list = []
    for root, dirs, files in os.walk(static_dir):
        for f in files:
            rel_path = os.path.relpath(os.path.join(root, f), static_dir)
            file_list.append(rel_path)
    return {"static_files": file_list}
