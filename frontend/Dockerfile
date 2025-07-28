FROM node:18-alpine AS build

WORKDIR /app

# Copy package files (Railway runs from frontend dir)
COPY package*.json ./
RUN npm ci

# Copy all files from current directory
COPY . ./
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/nginx.conf.template

EXPOSE $PORT

CMD envsubst '${PORT}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf && nginx -g 'daemon off;'