import os
import mimetypes
import logging
import boto3
from fastapi import FastAPI, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import (
    HTMLResponse,
    JSONResponse,
    FileResponse,
    StreamingResponse,
    Response,
)
from starlette.middleware.base import BaseHTTPMiddleware

# Configure logging
logger = logging.getLogger("media_proxy")

# Railway Object Storage env vars
RAILWAY_BUCKET = os.getenv("RAILWAY_BUCKET")
RAILWAY_ENDPOINT = os.getenv("RAILWAY_ENDPOINT")
RAILWAY_ACCESS_KEY = os.getenv("RAILWAY_ACCESS_KEY")
RAILWAY_SECRET_KEY = os.getenv("RAILWAY_SECRET_KEY")

if not all([RAILWAY_BUCKET, RAILWAY_ENDPOINT, RAILWAY_ACCESS_KEY, RAILWAY_SECRET_KEY]):
    raise RuntimeError("Missing Railway Object Storage environment variables")

# Initialize S3 client with Railway credentials
s3_client = boto3.client(
    "s3",
    endpoint_url=RAILWAY_ENDPOINT,
    aws_access_key_id=RAILWAY_ACCESS_KEY,
    aws_secret_access_key=RAILWAY_SECRET_KEY,
)

app = FastAPI()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Mount static folder (CSS, JS, favicon)
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")

# Mount assets folder (images + icons)
app.mount("/assets", StaticFiles(directory=os.path.join(BASE_DIR, "assets")), name="assets")


# --- Custom middleware to force HTTPS ---
class ForceHTTPSMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        request.scope["scheme"] = "https"
        response = await call_next(request)
        return response

app.add_middleware(ForceHTTPSMiddleware)

# Point Jinja2 directly to CUZ (since templates are here)
templates = Jinja2Templates(directory=BASE_DIR)

@app.get("/", response_class=HTMLResponse)
async def serve_index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return FileResponse(os.path.join(BASE_DIR, "static", "favicon.ico"))

@app.get("/{template_name}", response_class=HTMLResponse)
async def serve_template(request: Request, template_name: str):
    if not template_name.endswith(".html"):
        template_name += ".html"
    return templates.TemplateResponse(template_name, {"request": request})

@app.get("/heartbeat")
async def heartbeat():
    return JSONResponse(content={"status": "ok", "message": "Service is running"})

@app.get("/debug/static")
async def list_static_files():
    static_dir = os.path.join(BASE_DIR, "static")
    file_list = []
    for root, dirs, files in os.walk(static_dir):
        for f in files:
            rel_path = os.path.relpath(os.path.join(root, f), static_dir)
            file_list.append(rel_path)
    return {"static_files": file_list}

@app.get("/debug/assets")
async def list_assets():
    assets_dir = os.path.join(BASE_DIR, "assets")
    file_list = []
    for root, dirs, files in os.walk(assets_dir):
        for f in files:
            rel_path = os.path.relpath(os.path.join(root, f), assets_dir)
            file_list.append(rel_path)
    return {"assets_files": file_list}


# --- Media proxy endpoint (S3) ---
@app.get("/media/{file_path:path}")
async def get_media_proxy(file_path: str, request: Request):
    try:
        logger.debug(f"[MEDIA PROXY] Raw requested file_path={file_path}")

        # Normalize if full URL was stored
        if file_path.startswith("http://") or file_path.startswith("https://"):
            parsed = file_path.split("/media/", 1)
            if len(parsed) == 2:
                file_path = parsed[1]

        # Strip domain prefix if present
        if file_path.startswith("klenoboardinghouse-production.up.railway.app/media/"):
            file_path = file_path.split("klenoboardinghouse-production.up.railway.app/media/", 1)[1]

        # Fetch metadata from S3
        head = s3_client.head_object(Bucket=RAILWAY_BUCKET, Key=file_path)
        file_size = head["ContentLength"]

        guessed_type, _ = mimetypes.guess_type(file_path)
        content_type = guessed_type or head.get("ContentType", "application/octet-stream")

        base_headers = {
            "Content-Length": str(file_size),
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=31536000",
            "X-Content-Type-Options": "nosniff",
        }
        if not (content_type.startswith("image/") or content_type.startswith("video/")):
            base_headers["Content-Disposition"] = f'attachment; filename="{os.path.basename(file_path)}"'

        # Handle Range requests (video streaming)
        range_header = request.headers.get("range")
        if range_header:
            start_str, end_str = range_header.replace("bytes=", "").split("-")
            start = int(start_str) if start_str else 0
            end = int(end_str) if end_str else file_size - 1
            obj = s3_client.get_object(Bucket=RAILWAY_BUCKET, Key=file_path, Range=f"bytes={start}-{end}")
            return Response(
                content=obj["Body"].read(),
                status_code=206,
                headers={**base_headers, "Content-Range": f"bytes {start}-{end}/{file_size}", "Content-Type": content_type},
            )

        # Full file
        obj = s3_client.get_object(Bucket=RAILWAY_BUCKET, Key=file_path)
        return StreamingResponse(obj["Body"], media_type=content_type, headers=base_headers)

    except s3_client.exceptions.NoSuchKey:
        raise HTTPException(status_code=404, detail="File not found")
    except Exception as e:
        logger.error(f"[MEDIA PROXY] Proxy streaming error for {file_path}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error fetching file")
