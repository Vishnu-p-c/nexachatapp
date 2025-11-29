FROM node:18-alpine

# Create app directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy app source
COPY . .

# Expose port
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]
