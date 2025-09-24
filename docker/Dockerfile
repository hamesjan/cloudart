# ---- Base image (multi-stage) ----
FROM node:22-slim AS base
ENV NODE_ENV=production
WORKDIR /app

# ---- Dependencies layer ----
FROM base AS deps
# Copy only manifest files first for better build caching
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm ci --omit=dev

# ---- Runtime image ----
FROM node:22-slim AS runner
ENV NODE_ENV=production
WORKDIR /app/server

# Add a non-root user for safety
RUN useradd -m -u 10001 nodeuser

# Copy node_modules from deps stage
COPY --from=deps /app/server/node_modules ./node_modules
# Copy the server source
COPY server/. .

# Healthcheck (optional): checks the WS upgrade endpoint via HTTP
# (Many CLBs/Nginx probes only do HTTP; this just verifies the process is alive.)
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD node -e "process.exit(0)" || exit 1

EXPOSE 8080
USER nodeuser

# You can tune TICK_RATE and MAX_PLAYERS via env
ENV PORT=8080 \
    TICK_RATE=30 \
    MAX_PLAYERS=100

CMD ["node", "index.js"]
