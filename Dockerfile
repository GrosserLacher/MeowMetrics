FROM python:3.12-slim

WORKDIR /app

# Systembibliotheken für die PDF-Erzeugung (WeasyPrint) und Schriften
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz-subset0 fonts-dejavu-core fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Abhängigkeiten installieren (inkl. python-multipart für Datei-Uploads, weasyprint für den PDF-Bericht)
COPY requirements.txt* ./
RUN pip install --no-cache-dir fastapi "uvicorn[standard]" pydantic python-multipart pywebpush weasyprint

# Anwendungsdaten kopieren
COPY ./app /app/app

# Verzeichnisse für SQLite und Bilder vorbereiten
RUN mkdir -p /app/data/uploads /app/app/static

EXPOSE 8000

#CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=*"]
