# =============================================================================
# FRONTEND DOCKERFILE - React + Vite
# =============================================================================
# This builds your React frontend and serves it with nginx (a fast web server).
#
# HOW THIS WORKS:
# 1. Build stage: Compiles TypeScript and bundles React code
# 2. Serve stage: Uses nginx to serve the static files
# =============================================================================

# -----------------------------------------------------------------------------
# STAGE 1: BUILD
# -----------------------------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

# Copy package files first (for Docker caching)
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build arguments - these become environment variables during build
# Vite requires VITE_ prefix for env vars to be included in the build
ARG VITE_API_URL
ARG VITE_HUB_URL

# Set environment variables for the build
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_HUB_URL=$VITE_HUB_URL

# Build the production bundle
RUN npm run build

# -----------------------------------------------------------------------------
# STAGE 2: SERVE WITH NGINX
# -----------------------------------------------------------------------------
FROM nginx:alpine AS production
WORKDIR /usr/share/nginx/html

# Remove default nginx static files
RUN rm -rf ./*

# Copy built files from build stage
COPY --from=build /app/dist .

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
