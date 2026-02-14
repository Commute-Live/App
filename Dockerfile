FROM node:20.19.0-bookworm-slim

WORKDIR /usr/src/app

ENV EXPO_NO_TELEMETRY=1
ENV CI=false

COPY package.json package-lock.json ./
RUN npm ci
RUN npm install -g @expo/ngrok@^4.1.0

COPY . .

EXPOSE 8081
EXPOSE 19000
EXPOSE 19001
EXPOSE 19002
EXPOSE 19006

CMD ["npm", "run", "start:expo", "--", "--tunnel", "--clear"]
