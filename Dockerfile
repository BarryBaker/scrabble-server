# Use a base image that supports Hunspell installation
FROM node:20-bookworm-slim

# Install dependencies and necessary tools
RUN apt-get update && apt-get install -y \
    wget \
    curl \
    locales \
    pkg-config \
    gettext \
    python3 \
    python3-pip \
    python3-venv \
    hunspell \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Hunspell CLI is provided by the package above; no source build required

# Set default locale to Hungarian (can be changed if necessary)
ENV LANG=hu_HU.UTF-8
ENV LANGUAGE=hu_HU:hu
ENV LC_ALL=hu_HU.UTF-8

# Copy dictionary files into the Docker image
COPY hunspell_dictionaries/*.aff /usr/local/share/hunspell/
COPY hunspell_dictionaries/*.dic /usr/local/share/hunspell/

# Set the environment variable so hunspell can find the dictionary without full path
ENV DICPATH=/usr/local/share/hunspell

# Set the working directory and copy your app code
WORKDIR /usr/src/app
COPY . .


# Create Python virtual environment and install dependencies
RUN python3 -m venv python_app/venv && \
    python_app/venv/bin/pip install --upgrade pip && \
    python_app/venv/bin/pip install numpy


# Install Node.js dependencies
RUN npm install

# Expose port (if needed)
EXPOSE 3000

# Start the application
CMD ["npm", "start"]