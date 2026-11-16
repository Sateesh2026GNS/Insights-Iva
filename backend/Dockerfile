FROM python:3.12-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY . .

# Operator page allowlist is packaged under app/core/ (not the frontend tree).
# Render dockerContext is backend-only; fail the image build if the file is missing.
RUN test -f /app/app/core/operator_page_allowlist.json

RUN mkdir -p /app/data

EXPOSE 8000 10000

# Run DB migrations then serve via gunicorn with uvicorn workers.
CMD ["sh", "-c", "alembic upgrade heads && gunicorn app.main:app -k uvicorn.workers.UvicornWorker -w ${WEB_CONCURRENCY:-2} -b 0.0.0.0:${PORT:-8000}"]

