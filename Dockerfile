FROM node:26.7-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY index.ts .

USER node

CMD ["node", "--experimental-strip-types", "index.ts"]