FROM node:20-bookworm-slim

# System deps (Hunspell CLI + locales + python if you need it)
RUN apt-get update && apt-get install -y \
    hunspell \
    locales \
    python3 \
    python3-pip \
    python3-venv \
    curl \
    wget \
 && apt-get clean && rm -rf /var/lib/apt/lists/*

# Locale (adjust if you need HU as default)
ENV LANG=hu_HU.UTF-8
ENV LANGUAGE=hu_HU:hu
ENV LC_ALL=hu_HU.UTF-8

# Hunspell dictionaries (you ship them in repo)
ENV DICPATH=/usr/local/share/hunspell
COPY hunspell_dictionaries/*.aff /usr/local/share/hunspell/
COPY hunspell_dictionaries/*.dic /usr/local/share/hunspell/

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

EXPOSE 3000
CMD ["npm", "start"]