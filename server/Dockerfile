FROM node:18

WORKDIR /app

# Copy package files first to leverage Docker cache
COPY package*.json ./

# Install dependencies, including build tools for bcrypt
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    && npm install

# Copy the rest of the application
COPY . .

# Expose port
EXPOSE 3000

# Start the server
CMD ["npm", "start"]