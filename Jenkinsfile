// 프로젝트 루트에 'Jenkinsfile' (확장자 없음) 이름으로 복사해서 쓰세요.
//   cp docs/Jenkinsfile.example Jenkinsfile
//
// 필요한 Jenkins 설정
//   - Tools: NodeJS 이름 'node-22'
//   - Credentials: 'ghcr-credentials' (GitHub ID + write:packages 토큰)
//                  'ec2-ssh-key'      (사용자 ubuntu + 배포 전용 개인키)
//   - 플러그인: SSH Agent, NodeJS, JUnit

pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()                        // 동시에 두 번 배포되는 것 방지
        timeout(time: 40, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '20'))   // 오래된 빌드 기록 정리
    }

    tools {
        nodejs 'node-26'
    }

    environment {
        IMAGE_REPO  = 'ghcr.io/justhumannn'              // 전부 소문자
        DEPLOY_USER = 'ubuntu'
        DEPLOY_HOST = 'webtoon.quest'                    // 앱 서버 (도메인 또는 탄력적 IP)
        APP_URL     = 'https://webtoon.quest'

        // ⭐ 처음에는 'false' 로 두고 Checkout~Docker build 까지만 통과시키세요.
        //    잘 되면 'true' 로 바꿔 push / 배포 / 헬스체크 / 롤백까지 켭니다.
        ENABLE_DEPLOY = 'false'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    // 이미지 태그 = 짧은 커밋 SHA (어떤 코드가 떠 있는지 추적 가능)
                    env.TAG = sh(returnStdout: true, script: 'git rev-parse --short=7 HEAD').trim()
                }
                echo "이번 빌드 태그: ${env.TAG}"
            }
        }

        stage('Backend: test & build') {
            steps {
                dir('backend') {
                    sh 'chmod +x gradlew'
                    sh './gradlew --no-daemon test bootJar'
                }
            }
            post {
                always {
                    junit allowEmptyResults: true, testResults: 'backend/build/test-results/test/*.xml'
                }
            }
        }

        stage('Frontend: lint & build') {
            steps {
                dir('frontend') {
                    sh 'npm ci'
                    sh 'npm run lint'
                    sh 'npm run build'
                }
            }
        }

        stage('Docker build') {
            steps {
                sh 'docker build -t $IMAGE_REPO/webtoon-backend:$TAG  backend'
                sh 'docker build -t $IMAGE_REPO/webtoon-frontend:$TAG frontend'
            }
        }

        stage('Push') {
            when {
                allOf {
                    expression { env.ENABLE_DEPLOY == 'true' }
                    expression { env.GIT_BRANCH == 'origin/main' }    // main 브랜치만 배포
                }
            }
            steps {
                withCredentials([usernamePassword(
                        credentialsId: 'ghcr-credentials',
                        usernameVariable: 'REG_USER',
                        passwordVariable: 'REG_TOKEN')]) {
                    // 작은따옴표: 토큰을 Groovy 가 아니라 셸이 읽게 해서 로그/이력에 새지 않도록
                    sh 'echo "$REG_TOKEN" | docker login ghcr.io -u "$REG_USER" --password-stdin'
                }
                sh 'docker push $IMAGE_REPO/webtoon-backend:$TAG'
                sh 'docker push $IMAGE_REPO/webtoon-frontend:$TAG'
            }
        }

        stage('Deploy') {
            when {
                allOf {
                    expression { env.ENABLE_DEPLOY == 'true' }
                    expression { env.GIT_BRANCH == 'origin/main' }
                }
            }
            steps {
                sshagent(credentials: ['ec2-ssh-key']) {
                    script {
                        def ssh = "ssh -o StrictHostKeyChecking=accept-new ${DEPLOY_USER}@${DEPLOY_HOST}"

                        // 1) 롤백을 대비해 '지금 떠 있는 태그'를 먼저 기록
                        env.PREV_TAG = sh(
                            returnStdout: true,
                            script: "${ssh} \"grep '^TAG=' /opt/webtoon/.env | cut -d= -f2\" || true"
                        ).trim()
                        echo "이전 태그: ${env.PREV_TAG ?: '(없음)'}"

                        // 2) 설정 파일과 스크립트 전송
                        sh "scp -o StrictHostKeyChecking=accept-new -r deploy/docker-compose.yml deploy/deploy.sh deploy/nginx ${DEPLOY_USER}@${DEPLOY_HOST}:/opt/webtoon/"

                        // 3) 배포 (이 시점부터 실패하면 롤백 대상)
                        env.DEPLOY_STARTED = 'true'
                        sh "${ssh} 'chmod +x /opt/webtoon/deploy.sh && /opt/webtoon/deploy.sh ${env.TAG}'"
                    }
                }
            }
        }

        stage('Health check') {
            when {
                allOf {
                    expression { env.ENABLE_DEPLOY == 'true' }
                    expression { env.GIT_BRANCH == 'origin/main' }
                }
            }
            steps {
                // 새 컨테이너가 뜰 시간을 주며 최대 ~2분 재시도. 끝까지 실패하면 스테이지 실패 → post 에서 롤백
                sh '''
                    for i in $(seq 1 24); do
                      if curl -fsS "$APP_URL/actuator/health" | grep -q '"status":"UP"'; then
                        echo "헬스체크 통과"; exit 0
                      fi
                      echo "대기 중... ($i/24)"; sleep 5
                    done
                    echo "헬스체크 실패"; exit 1
                '''
            }
        }
    }

    post {
        failure {
            script {
                // 배포가 시작된 뒤에 실패했고, 되돌릴 이전 태그가 있을 때만 롤백
                if (env.DEPLOY_STARTED == 'true' && env.PREV_TAG) {
                    echo "롤백: ${env.PREV_TAG}"
                    sshagent(credentials: ['ec2-ssh-key']) {
                        sh "ssh -o StrictHostKeyChecking=accept-new ${DEPLOY_USER}@${DEPLOY_HOST} '/opt/webtoon/deploy.sh ${env.PREV_TAG}'"
                    }
                } else {
                    echo '롤백 불필요 (배포 전 단계에서 실패했거나 이전 태그 없음)'
                }
            }
        }
        always {
            sh 'docker logout ghcr.io || true'
            sh 'docker image prune -f || true'           // Jenkins 서버의 빌드 잔여 이미지 정리
        }
    }
}
