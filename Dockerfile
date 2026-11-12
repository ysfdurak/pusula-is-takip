# Pusula pilot sunucusu
#   docker build -t pusula:0.6.0 .
#   docker run -d --name pusula --env-file .env -p 127.0.0.1:8080:8080 -v pusula-data:/data pusula:0.6.0
# Ayrıntı: docs/PILOT_KURULUM.md

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.js ./
COPY vite.mcp-app.config.js ./
COPY src ./src
RUN npm run build:pilot && npm run build:mcp-app

FROM node:22-bookworm-slim
ENV NODE_ENV=production DATA_DIR=/data PORT=8080
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY server ./server
COPY src/shared ./src/shared
COPY --from=build /app/dist-pilot ./dist-pilot
COPY --from=build /app/dist-mcp-app ./dist-mcp-app
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--disable-warning=ExperimentalWarning", "server/index.js"]
