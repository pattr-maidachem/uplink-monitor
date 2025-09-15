FROM node:22-alpine

WORKDIR /app

# Copy package.json & lock first (better caching)
COPY package*.json ./
RUN npm install

COPY . .

# Start server (compiled backend will serve frontend)
CMD ["npm", "start"]

EXPOSE 3001
EXPOSE 5172
