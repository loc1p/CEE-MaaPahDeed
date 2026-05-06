FROM node:20-bookworm-slim

WORKDIR /app

COPY backend/package*.json ./backend/
RUN npm --prefix backend ci --omit=dev

COPY backend ./backend
COPY frontend ./frontend

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["npm", "--prefix", "backend", "start"]
