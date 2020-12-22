#!/usr/bin/env sh
COMMIT_ID=$(git rev-parse --verify HEAD | cut -c1-5)
VERSION=dev
PROJECT_NAME=video-platform-api

if [ ! -z $1 ]; then
    VERSION=$1
fi

docker build -t "${PROJECT_NAME}:latest" -t "${PROJECT_NAME}:${VERSION}-${COMMIT_ID}" .