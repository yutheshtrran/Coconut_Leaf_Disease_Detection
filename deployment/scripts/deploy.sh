#!/bin/bash

# This script is used to deploy the coconut leaf detection application.

# Step 1: Build the Docker images
echo "Building Docker images..."
docker-compose build

# Step 2: Start the services
echo "Starting services..."
docker-compose up -d

# Step 3: Run database migrations (if applicable)
# Uncomment the following line if you have migrations to run
# echo "Running database migrations..."
# docker-compose exec backend npm run migrate

# Step 4: Check the status of the services
echo "Checking the status of the services..."
docker-compose ps

echo "Deployment completed successfully!"