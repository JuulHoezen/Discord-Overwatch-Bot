FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# Eerst alleen de lockfile: dat maakt de image-laag cachebaar.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# De bot gebruikt de gedeelde command-laag in shared/.
COPY shared ./shared
COPY bot ./bot

# De bot leest .env via een absoluut pad naast package.json. In Docker is dat
# niet nodig: geef de waarden mee als echte omgevingsvariabelen (--env-file of
# env_file in docker-compose.yml). dotenv overschrijft bestaande variabelen niet.
CMD ["node", "bot/index.js"]
