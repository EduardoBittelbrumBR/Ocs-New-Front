# ===== Stage 1: build do Angular =====
FROM node:22-bookworm-slim AS web
WORKDIR /web
COPY web/package.json web/package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY web/ ./
RUN npx ng build --configuration=production

# ===== Stage 2: dependencias do servidor =====
FROM node:22-bookworm-slim AS server
WORKDIR /srv
COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

# ===== Stage 3: runtime =====
FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /srv
COPY server/ ./
COPY --from=server /srv/node_modules ./node_modules
COPY --from=web /web/dist/web/browser ./public
# roda como usuário sem privilégios (Achado 8) — só leitura sobre /srv
USER node
EXPOSE 3000
CMD ["node", "server.js"]
