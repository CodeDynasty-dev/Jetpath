# syntax = docker/dockerfile:1

# Use Node.js as base (has npm), then add Bun for runtime
FROM node:22-slim

LABEL maintainer="jetpath"

WORKDIR /app

# Install Bun
RUN npm install -g bun

# Set production environment
ENV NODE_ENV="production"

# Copy package files and tgz
COPY package.json ./
COPY jetpath-1.12.6.tgz ./

# Install dependencies with npm
RUN npm install

# Copy source code
COPY . .

# Start with bun
EXPOSE 9000
CMD [ "bun", "run", "index.jet.ts" ]