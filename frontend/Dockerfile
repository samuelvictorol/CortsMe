FROM node:22-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
ARG API_URL=http://localhost:3000/api
ARG SOCKET_URL=http://localhost:3000
ARG GOOGLE_CLIENT_ID=
ENV API_URL=$API_URL
ENV SOCKET_URL=$SOCKET_URL
ENV GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/spa /usr/share/nginx/html
EXPOSE 80
