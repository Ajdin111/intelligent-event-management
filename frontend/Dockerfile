# Node.js LTS as base image for React + Vite
FROM node:20-slim

WORKDIR /app

# Install dependencies first for better layer caching
# If package.json hasn't changed, Docker skips npm install on rebuild
COPY package.json package-lock.json* ./
RUN npm install

# In development the code is mounted as a volume
# Changes to React components are reflected instantly via Vite hot reload

# Expose Vite dev server port
EXPOSE 5173

# Start Vite dev server
# --host 0.0.0.0 makes it accessible outside the container
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
