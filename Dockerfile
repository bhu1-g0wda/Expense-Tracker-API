
FROM node:18-slim

# Install MongoDB dependencies and tools needed for installation
RUN apt-get update && apt-get install -y \
    gnupg \
    wget \
    curl \
    lsb-release

# Import MongoDB public GPG key AND create list file
# Using MongoDB 6.0 as an example version compatible with Debian Bullseye (node:18-slim is usually bullseye)
RUN curl -fsSL https://pgp.mongodb.com/server-6.0.asc | \
    gpg -o /usr/share/keyrings/mongodb-server-6.0.gpg --dearmor

RUN echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-6.0.gpg ] http://repo.mongodb.org/apt/debian bullseye/mongodb-org/6.0 main" | \
    tee /etc/apt/sources.list.d/mongodb-org-6.0.list

# Install MongoDB
RUN apt-get update && apt-get install -y mongodb-org

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node dependencies
RUN npm install

# Copy source code and start script
COPY . .

# Make start script executable
RUN chmod +x start.sh

# Environment variables
ENV MONGO_URI=mongodb://127.0.0.1:27017/expense_tracker
ENV PORT=3000

# Expose API port
EXPOSE 3000

# Start everything
CMD ["./start.sh"]
