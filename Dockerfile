# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine

# Install bash and other utilities
RUN apk add --no-cache bash curl wget git nano vim htop

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application files
COPY . .

# Create a non-root user for SSH sessions
RUN adduser -D -s /bin/bash sshuser

# Expose the combined port (Railway only allows one port)
EXPOSE 3000

# Start the SSH server
CMD ["npm", "start"]