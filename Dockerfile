FROM node:6.5

# create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# install yarn
RUN npm i -g yarn

# install dependencies
COPY package.json yarn.lock /usr/src/app/
RUN yarn

# bundle app source
COPY . /usr/src/app

# production environment
ENV NODE_ENV production

CMD [ "npm", "start" ]
