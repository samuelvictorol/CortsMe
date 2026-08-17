FROM node:22-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
ARG API_URL=/api
ARG SOCKET_URL=
ARG GOOGLE_CLIENT_ID=
ENV API_URL=$API_URL
ENV SOCKET_URL=$SOCKET_URL
ENV GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
RUN npm run build

FROM nginx:1.27-alpine
ENV PORT=80 \
    API_UPSTREAM=cortsme-api:3000 \
    NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1

COPY --chmod=755 docker-entrypoint.d/16-normalize-api-upstream.envsh /docker-entrypoint.d/16-normalize-api-upstream.envsh
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/spa /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" || exit 1
CMD ["nginx", "-g", "daemon off;"]
