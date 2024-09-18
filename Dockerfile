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
    hunspell \
    hunspell-hu && \
    apt-get clean

# Set up Hungarian locale (for accurate results in Hunspell)
RUN sed -i '/hu_HU.UTF-8/s/^# //g' /etc/locale.gen && locale-gen
ENV LANG=hu_HU.UTF-8
ENV LANGUAGE=hu_HU:hu
ENV LC_ALL=hu_HU.UTF-8

# Create symbolic links so hunspell can find the dictionary automatically
RUN mkdir -p /usr/local/share/hunspell && \
    ln -s /usr/share/hunspell/hu_HU.aff /usr/local/share/hunspell/hu_HU.aff && \
    ln -s /usr/share/hunspell/hu_HU.dic /usr/local/share/hunspell/hu_HU.dic

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