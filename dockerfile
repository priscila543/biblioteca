FROM node:18

WORKDIR /usr/src/app

# Instalar dependências necessárias para compilar sqlite3
RUN apt-get update && apt-get install -y python3 g++ make

COPY package.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "app.js"]
