FROM node:12

# create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# install dependencies
COPY package.json package-lock.json /usr/src/app/
RUN npm ci

# bundle app source
COPY . /usr/src/app

# production environment
ENV NODE_ENV production

# build the server
RUN npm run build

CMD [ "npm", "run", "start:prod" ]
