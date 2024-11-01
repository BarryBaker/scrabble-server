# Use a base image that supports Hunspell installation
FROM node:14-slim  

# Install dependencies and necessary tools
RUN apt-get update && apt-get install -y \
    build-essential \
    autoconf \
    automake \
    libtool \
    wget \
    curl \
    locales \
    hunspell && \
    apt-get clean


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

# Install Node.js dependencies
RUN npm install

# Expose port (if needed)
EXPOSE 3000

# Start the application (adjust as needed)
CMD ["npm", "start"]