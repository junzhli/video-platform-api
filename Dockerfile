FROM node:12-alpine

WORKDIR /app

COPY . .

RUN apk update && \ 
    apk add --no-cache python3 alpine-sdk gcc make && \
    yarn install --forzen-lockfile && \
    addgroup -S user && \
    adduser -S -G user user && \
    chown -R user:user ./

ENTRYPOINT [ "yarn", "run", "prod" ]
