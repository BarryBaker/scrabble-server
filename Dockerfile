# Use an official Node.js runtime as a parent image
FROM node:14

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy the package.json and package-lock.json files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application files
COPY . .

# Install Hunspell and the Hungarian dictionary
RUN apt-get update && \
    apt-get install -y --no-install-recommends hunspell curl && \
    mkdir -p /usr/local/share/hunspell && \
    curl -o /usr/local/share/hunspell/hu_HU.aff https://cgit.freedesktop.org/libreoffice/dictionaries/plain/hu_HU/hu_HU.aff && \
    curl -o /usr/local/share/hunspell/hu_HU.dic https://cgit.freedesktop.org/libreoffice/dictionaries/plain/hu_HU/hu_HU.dic && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Expose port 80 to the outside world
EXPOSE 80

# Define the command to run the application
CMD ["node", "server.js"]