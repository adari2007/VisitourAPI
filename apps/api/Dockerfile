FROM node:20-alpine

WORKDIR /app

# Install production dependencies first for better layer caching.
COPY apps/api/package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# Copy application source.
COPY apps/api/ ./

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]

