FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
RUN mkdir -p public/uploads/cards public/uploads/avatars
EXPOSE 8080
CMD ["npm", "start"]
