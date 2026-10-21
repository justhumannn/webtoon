#!/usr/bin/env bash
# 사용법: ./deploy.sh <이미지 태그>   예) ./deploy.sh manual1
set -euo pipefail

cd /opt/webtoon
TAG="${1:?태그를 넘겨 주세요}"

# compose 가 읽는 .env 의 TAG 줄만 교체
sed -i "s/^TAG=.*/TAG=${TAG}/" .env

docker compose pull                     # 레지스트리에서 새 이미지 내려받기
docker compose up -d --remove-orphans   # 바뀐 컨테이너만 교체
docker image prune -f                   # 쓰지 않는 이미지 정리 (디스크 절약)