# Single-stage build is intentional here: this is a small backend capstone,
# not a multi-arch production release. Section 10 of the brief promises a
# $0 stack that "just runs" — an extra build stage would add ceremony
# without adding anything an evaluator or a stranger cloning the repo needs.
FROM node:20-slim

WORKDIR /app

# Production-only install: the Docker path always talks to Postgres (see
# docker-compose.yml), so the sqlite3 devDependency — and the native build
# tools it would otherwise need — are never pulled into this image.
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "src/server.js"]
