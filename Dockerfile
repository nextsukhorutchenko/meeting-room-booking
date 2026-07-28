FROM node:22.23.1-bookworm-slim AS base

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
    && apt-get install --yes --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

FROM base AS native-dependencies

COPY package.json package-lock.json ./
RUN apt-get update \
    && apt-get install --yes --no-install-recommends g++ make python3 \
    && rm -rf /var/lib/apt/lists/*
RUN npm ci --no-audit

FROM base AS dependencies

COPY package.json package-lock.json ./
COPY --from=native-dependencies /app/node_modules ./node_modules

FROM dependencies AS source

COPY . .
RUN DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder \
    npm run db:generate

FROM source AS builder

RUN DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder \
    APP_URL=http://localhost:3000 \
    npm run build

FROM source AS setup

USER node
CMD ["sh", "-c", "npx prisma migrate deploy && npm run db:seed"]

FROM base AS runner

ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 3000

CMD ["node", "server.js"]
