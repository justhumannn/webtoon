# ---------- 1단계: 빌드 ----------
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app

# 의존성 관련 파일만 먼저 복사 → 소스가 바뀌어도 의존성 다운로드는 캐시됨
COPY gradlew settings.gradle.kts build.gradle.kts ./
COPY gradle gradle
RUN chmod +x gradlew && ./gradlew --no-daemon dependencies > /dev/null 2>&1 || true

COPY src src
# 테스트는 Jenkins 가 이미 돌렸으므로 이미지 빌드에서는 생략 (7장 참고)
RUN ./gradlew --no-daemon bootJar -x test

# ---------- 2단계: 실행 ----------
FROM eclipse-temurin:21-jre
WORKDIR /app

# 컨테이너 헬스체크용 curl (JRE 이미지에 있다고 가정하지 말고 명시적으로 설치)
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*

# root 로 실행하지 않기 (보안 기본기)
RUN useradd --system --uid 1001 spring
USER spring

COPY --from=build /app/build/libs/app.jar app.jar

EXPOSE 8080
# 컨테이너 메모리에 비례해 힙 크기를 정함 (작은 인스턴스에서 OOM 방지)
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70"
ENTRYPOINT ["java", "-jar", "app.jar"]