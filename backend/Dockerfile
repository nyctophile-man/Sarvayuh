# ---- build stage: compile the TypeScript chatbot module ----
FROM node:20-slim AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY tsconfig.json ./
COPY Ai ./Ai
RUN npx tsc -p tsconfig.json && \
    if [ -f dist/Ai/sarvayuh-chatbot.js ]; then cp dist/Ai/sarvayuh-chatbot.js dist/sarvayuh-chatbot.js; fi

# ---- runtime ----
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
RUN mkdir -p /app/storage
COPY package.json ./
RUN npm install --omit=dev
COPY . .
COPY --from=build /app/dist ./dist
EXPOSE 4000
CMD ["npx", "tsx", "api-gateway/server.js"]
