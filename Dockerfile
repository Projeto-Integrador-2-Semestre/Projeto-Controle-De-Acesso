# Estágio 1: Build da aplicação React com Vite
FROM node:20-alpine AS build

WORKDIR /app

# Instala dependências
COPY package*.json ./
RUN npm install

# Copia os arquivos do projeto e gera a pasta dist
COPY . .
RUN npm run build

# Estágio 2: Servidor Nginx para servir a aplicação em produção
FROM nginx:alpine

# Copia os arquivos estáticos gerados no build para o diretório padrão do Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Configuração do Nginx para suportar Single Page Application (React Router)
RUN printf 'server {\n\
    listen 80;\n\
    server_name localhost;\n\
    location / {\n\
        root /usr/share/nginx/html;\n\
        index index.html index.htm;\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
