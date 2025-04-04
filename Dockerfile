# Use a lightweight Node.js base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy files into the container
COPY . .

# Install dependencies
RUN npm install
RUN npm install -g nodemon
RUN npm install pm2 -g
# Set environment variable for mode
ARG NODE_ENV
ENV NODE_ENV $NODE_ENV

# Run the bot based on the environment
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
CMD ["/entrypoint.sh"]

