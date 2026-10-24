# Cloud Run: linux/amd64. On Apple Silicon use scripts/docker-build-push-cloud-run.sh
# so the registry gets a single-arch manifest (Buildx attestations break Cloud Run).
FROM --platform=linux/amd64 node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Real-ESRGAN: download binary + models (~60 MB) for image upscaling
FROM base AS realesrgan
WORKDIR /tmp/realesrgan
RUN apt-get update && apt-get install -y --no-install-recommends curl unzip ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ARG REALESRGAN_VERSION=v0.2.5.0
# ncnn portable builds use a date stamp in the zip name, not the semver tag.
ARG REALESRGAN_NCNN_BUILD=20220424
RUN curl -fSL "https://github.com/xinntao/Real-ESRGAN/releases/download/${REALESRGAN_VERSION}/realesrgan-ncnn-vulkan-${REALESRGAN_NCNN_BUILD}-ubuntu.zip" -o realesrgan.zip \
    && unzip -q realesrgan.zip \
    && mkdir -p /opt/realesrgan/models \
    && cp -f realesrgan-ncnn-vulkan-${REALESRGAN_NCNN_BUILD}-ubuntu/realesrgan-ncnn-vulkan /opt/realesrgan/ \
    && cp -f realesrgan-ncnn-vulkan-${REALESRGAN_NCNN_BUILD}-ubuntu/models/* /opt/realesrgan/models/ \
    && chmod +x /opt/realesrgan/realesrgan-ncnn-vulkan \
    && rm -rf /tmp/realesrgan

FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/workflow-core/package.json packages/workflow-core/
COPY packages/web/package.json packages/web/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/workflow-core/node_modules ./packages/workflow-core/node_modules
COPY --from=deps /app/packages/web/node_modules ./packages/web/node_modules
COPY . .

# Next.js inlines NEXT_PUBLIC_* at build time. Runtime env on Cloud Run does not fix the client bundle.
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID
ARG NEXT_PUBLIC_STRIPE_PRO_PRICE_ID
ARG NEXT_PUBLIC_STRIPE_CREDITS_100_PRICE_ID
ARG NEXT_PUBLIC_STRIPE_CREDITS_500_PRICE_ID
ARG NEXT_PUBLIC_STRIPE_CREDITS_1500_PRICE_ID

ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET \
    NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID=$NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID \
    NEXT_PUBLIC_STRIPE_PRO_PRICE_ID=$NEXT_PUBLIC_STRIPE_PRO_PRICE_ID \
    NEXT_PUBLIC_STRIPE_CREDITS_100_PRICE_ID=$NEXT_PUBLIC_STRIPE_CREDITS_100_PRICE_ID \
    NEXT_PUBLIC_STRIPE_CREDITS_500_PRICE_ID=$NEXT_PUBLIC_STRIPE_CREDITS_500_PRICE_ID \
    NEXT_PUBLIC_STRIPE_CREDITS_1500_PRICE_ID=$NEXT_PUBLIC_STRIPE_CREDITS_1500_PRICE_ID

RUN pnpm -C packages/workflow-core build
RUN pnpm -C packages/web build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=realesrgan --chown=nextjs:nodejs /opt/realesrgan /app/bin/realesrgan
ENV REALESRGAN_BIN=/app/bin/realesrgan/realesrgan-ncnn-vulkan
ENV REALESRGAN_MODEL_DIR=/app/bin/realesrgan/models

# Vulkan/OpenMP libs needed by realesrgan-ncnn-vulkan at runtime
RUN apt-get update && apt-get install -y --no-install-recommends libvulkan1 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/packages/web/public ./packages/web/public
COPY --from=builder --chown=nextjs:nodejs /app/packages/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/packages/web/.next/static ./packages/web/.next/static

USER nextjs
EXPOSE 8080

CMD ["node", "packages/web/server.js"]
