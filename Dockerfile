FROM node:24 AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# smaller final stage that omits dev dependencies
FROM node:24-slim

ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

RUN ln -s /app/dist/cli.js /usr/local/bin/ccloud && chmod +x /usr/local/bin/ccloud

EXPOSE 3000

CMD ["node", "dist/main.js"]
