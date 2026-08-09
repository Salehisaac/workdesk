# ---- Frontend build ----
FROM node:20-alpine AS frontend

WORKDIR /build

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ .

ARG VITE_JOIN_BASE_URL
RUN npm run build

FROM golang:alpine AS backend

ENV GO111MODULE=on \
    CGO_ENABLED=0

WORKDIR /build

COPY . .
RUN go mod tidy
RUN go build --ldflags "-s -w -extldflags -static" -o main .


FROM alpine:latest

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /www

COPY --from=backend /build/main ./main
COPY --from=backend /build/resources/ ./resources/
COPY --from=frontend /build/dist/ ./public/
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh \
    && mkdir -p storage/app/public/uploads storage/logs

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
