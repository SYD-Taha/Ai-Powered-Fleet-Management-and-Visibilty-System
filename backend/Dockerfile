FROM node:18

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of your backend code
COPY . .

# Expose backend server port
EXPOSE 5000

# Start your backend
CMD ["npm", "start"]
