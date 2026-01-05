# =============================================================================
# BACKEND DOCKERFILE - ASP.NET Core 8.0
# =============================================================================
# This file tells Docker how to build your .NET backend into a container.
#
# WHAT IS DOCKER?
# Docker packages your app and all its dependencies into a "container" -
# a portable package that runs the same way everywhere (your laptop, server, cloud).
#
# HOW THIS WORKS:
# 1. Build stage: Compiles your .NET code
# 2. Runtime stage: Creates a small, optimized image to run your app
# =============================================================================

# -----------------------------------------------------------------------------
# STAGE 1: BUILD
# -----------------------------------------------------------------------------
# Use the official .NET SDK image to compile the code
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy solution and project files first (for better Docker caching)
# Docker caches each step - if files haven't changed, it skips rebuilding
COPY ChatApp.sln .
COPY ChatApp.API/ChatApp.API.csproj ChatApp.API/
COPY ChatApp.Core/ChatApp.Core.csproj ChatApp.Core/
COPY ChatApp.Infrastructure/ChatApp.Infrastructure.csproj ChatApp.Infrastructure/

# Restore NuGet packages (dependencies)
RUN dotnet restore

# Copy all source code
COPY . .

# Build the application in Release mode
WORKDIR /src/ChatApp.API
RUN dotnet publish -c Release -o /app/publish --no-restore

# -----------------------------------------------------------------------------
# STAGE 2: RUNTIME
# -----------------------------------------------------------------------------
# Use the smaller ASP.NET runtime image (not the full SDK)
# This makes the final image much smaller (~200MB vs ~700MB)
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# Create a non-root user for security
# Running as root in containers is a security risk
RUN adduser --disabled-password --gecos '' appuser

# Create uploads directory and set permissions
RUN mkdir -p /app/uploads/thumbnails && chown -R appuser:appuser /app

# Copy the compiled application from build stage
COPY --from=build /app/publish .

# Change ownership of app files
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port 8080 (Render.com expects this)
# Your app will listen on this port inside the container
EXPOSE 8080

# Set environment variables
# ASP.NET Core uses these to configure the server
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

# Health check - Docker/hosting platforms use this to verify the app is running
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Start the application
# This is the command that runs when the container starts
ENTRYPOINT ["dotnet", "ChatApp.API.dll"]
