FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY client/package*.json client/
COPY server/package*.json server/

RUN npm ci && npm ci --prefix client && npm ci --prefix server

COPY . .

EXPOSE 3000 5173 5001

CMD ["npm", "run", "dev"]
