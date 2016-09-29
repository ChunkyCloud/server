FROM node:6.5

# create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# install dependencies
COPY package.json /usr/src/app
RUN npm install

# bundle app source
COPY . /usr/src/app

# production environment
ENV NODE_ENV production

CMD [ "npm", "start" ]
