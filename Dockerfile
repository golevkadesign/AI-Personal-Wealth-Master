FROM node:22-trixie-slim AS build

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --include=optional

COPY . .
RUN node scripts/verify-longbridge-native.mjs --required
RUN npm run build
RUN npm prune --omit=dev --include=optional
RUN node scripts/verify-longbridge-native.mjs --required

FROM node:22-trixie-slim

ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

EXPOSE 8080

CMD ["node", "dist/server.js"]
