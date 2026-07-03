# yt-dlp needs python3 (the yt-dlp zip-app youtube-dl-exec fetches) and a JavaScript
# runtime for YouTube's player deciphering; node is used for the latter. A slim node
# base plus python3 covers both.
FROM node:20-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 ca-certificates && rm -rf /var/lib/apt/lists/*
# build context is the repo root (App Platform dockerfile_path build), so copy from
# the service subdirectory explicitly
WORKDIR /app
COPY server/youtube/package.json ./
RUN npm install --omit=dev
COPY server/youtube/index.js ./
ENV PORT=8080
EXPOSE 8080
CMD ["npm", "start"]
