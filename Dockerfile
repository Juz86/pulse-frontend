FROM node:20-alpine

WORKDIR /app

COPY backend-skeleton/package.json backend-skeleton/package-lock.json ./
RUN npm ci --omit=dev

COPY backend-skeleton/ ./

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "server.js"]
