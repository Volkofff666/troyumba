FROM node:20-alpine

# better-sqlite3 requires build tools
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY server.js .

# Ensure data directory exists for SQLite volume mount
RUN mkdir -p data

EXPOSE 3000

CMD ["node", "server.js"]
