
#!/bin/bash

# Create DB directory if it doesn't exist (persistence handling)
mkdir -p /data/db
chown -R mongodb:mongodb /data/db

# Start MongoDB in the background
echo "Starting MongoDB..."
mongod --fork --logpath /var/log/mongod.log --bind_ip 127.0.0.1

# Wait for Mongo to wake up
sleep 5

# Start Node Application
echo "Starting Node.js Application..."
node server.js
