FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
ARG VITE_AGENT_URL=http://localhost:3060
ARG VITE_AGENT_KEY=
ENV VITE_AGENT_URL=$VITE_AGENT_URL
ENV VITE_AGENT_KEY=$VITE_AGENT_KEY
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
