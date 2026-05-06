FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-pip \
    python3-venv \
  && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./backend/
RUN npm --prefix backend ci --omit=dev

COPY backend ./backend
COPY frontend ./frontend

RUN python3 -m venv /opt/lv-chordia \
  && /opt/lv-chordia/bin/pip install --no-cache-dir --upgrade pip \
  && /opt/lv-chordia/bin/pip install --no-cache-dir -r backend/ml/requirements.txt

ENV NODE_ENV=production
ENV PORT=8080
ENV LV_CHORDIA_PYTHON=/opt/lv-chordia/bin/python
ENV LV_CHORDIA_CWD=/app/backend

EXPOSE 8080

CMD ["npm", "--prefix", "backend", "start"]
