FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

# Use shell form to keep process in foreground
CMD npm run dev -- --host 0.0.0.0