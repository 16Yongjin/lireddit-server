FROM node:14

WORKDIR /usr/src/app

COPY package.json ./

COPY yarn.lock ./

RUN yarn

COPY . .
COPY .env.production .env

ENV NODE_ENV production

RUN yarn build

EXPOSE 8080

CMD [ "node", "dist/index.js" ]

USER node