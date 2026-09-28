# VERDIKT — Air-Gapped Production Container
# Zero external pip packages, zero network dependency, 100% laptop-friendly.

FROM python:3.11-slim

# Set environment
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOST=0.0.0.0 \
    PORT=8080

WORKDIR /app

# Copy application files
COPY fixtures.json .
COPY openapi.yaml .
COPY .dogfood.toml .
COPY run.py .
COPY server.py .
COPY src/ ./src/
COPY tests/ ./tests/

# Expose HTTP port
EXPOSE 8080

# Healthcheck ensuring portal is operational
HEALTHCHECK --interval=5s --timeout=3s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/projects')" || exit 1

# Start portal and auto-seed database
CMD ["python", "server.py"]
