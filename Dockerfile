FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
COPY src/assets src/assets
RUN npx prisma generate
RUN npm run build
EXPOSE 8080
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
