FROM node:20-alpine

WORKDIR /app

# Install production dependencies first for better layer caching.
COPY apps/api/package*.json ./
RUN npm ci --omit=dev

# Copy application source.
COPY apps/api/ ./

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]

