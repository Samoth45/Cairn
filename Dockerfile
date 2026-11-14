# syntax=docker/dockerfile:1

# ---- deps : installation des dépendances ----
FROM node:26-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- dev : serveur Vite avec hot reload ----
FROM deps AS dev
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ---- build : génération du bundle de production ----
FROM deps AS build
COPY . .
RUN npm run build

# ---- prod : nginx sert le dossier dist ----
FROM nginx:alpine AS prod
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
