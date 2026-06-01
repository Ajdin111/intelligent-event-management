FROM node:20-slim

WORKDIR /frontend

COPY package.json package-lock.json ./
RUN npm ci

CMD ["npx", "vite", "--config", "vite.config.docker.js"]
