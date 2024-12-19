# Use an official node image
FROM node:18-alpine

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Expose the port the backend listens on
EXPOSE 5000

# Start the backend
CMD ["node", "server.js"]
