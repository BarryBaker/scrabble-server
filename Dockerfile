# Use an official Node.js image as the base image
FROM node:14-bullseye-slim

# Install Hunspell and the Hungarian dictionary
RUN apt-get update && apt-get install -y \
    hunspell \
    hunspell-hu \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy the application code into the Docker image
COPY . .

# Install Node.js dependencies
RUN npm install

# Expose the port your server will run on
EXPOSE 3000

# Command to run your Node.js application
CMD ["node", "server.js"]