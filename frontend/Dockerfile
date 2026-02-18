# Use official Node image for build

FROM node:20-alpine as build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install
COPY . .

# Inject VITE_API_URL from build arg
ARG VITE_API_URL
RUN echo "VITE_API_URL=$VITE_API_URL" > .env

RUN npm run build

# Use nginx to serve the build
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
