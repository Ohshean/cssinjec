# Build stage
FROM node as builder

# /app 디렉토리 생성 및 작업 디렉토리 설정
WORKDIR /app

# 애플리케이션 코드 복사
COPY . /app

# npm 설치
RUN npm install

# Puppeteer 설치
RUN npm run postinstall --prefix ./node_modules/puppeteer

# 라이브러리 설치
RUN apt-get update && apt-get install -y debian-archive-keyring

RUN apt-get update && apt-get install -y \
    libnss3 \
    libxss1 \
    libasound2 \
    fonts-liberation \
    libappindicator3-1 \
    xdg-utils \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf2.0-0 \
    libgtk-3-0 \
    libx11-xcb1


# Production stage
FROM node as production

# /app 디렉토리 생성 및 작업 디렉토리 설정
WORKDIR /app

# 필요한 파일 복사
COPY --from=builder /app /app

# 환경 변수 설정
ENV NODE_ENV production

EXPOSE 1105

# 앱 실행
CMD ["npm", "start"]