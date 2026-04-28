FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
COPY prisma ./prisma
RUN apk add --no-cache openssl
RUN npm install
RUN npx prisma generate

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_URL=https://movienexus.e4z.xyz/api
RUN apk add --no-cache openssl
RUN npx prisma generate
RUN npm run build
# Copy Prisma client binary into standalone output
RUN cp -r node_modules/.prisma .next/standalone/node_modules/.prisma 2>/dev/null || true
RUN mkdir -p .next/standalone/node_modules/@prisma && cp -r node_modules/@prisma/client .next/standalone/node_modules/@prisma/client 2>/dev/null || true
RUN mkdir -p .next/standalone/node_modules/prisma && cp -r node_modules/prisma/. .next/standalone/node_modules/prisma/ 2>/dev/null || true

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache openssl

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Push Prisma schema (creates/migrates SQLite DB) then start Next.js
CMD ["sh", "-c", "node_modules/.bin/prisma db push --schema=./prisma/schema.prisma --skip-generate 2>&1 || true && node server.js"]
