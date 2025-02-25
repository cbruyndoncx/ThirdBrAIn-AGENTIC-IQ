![PySpur](./docs/images/hero.png)

<p align="center"><strong>PySpur은 파이썬 기반의 AI 에이전트 빌더입니다. AI 엔지니어들은 이를 사용해 에이전트를 구축하고, 단계별로 실행하며 과거 실행 기록을 검토합니다.</strong></p>

<p align="center">
  <a href="./README.md"><img alt="영문 README" src="https://img.shields.io/badge/English-blue"></a>
  <a href="./README_CN.md"><img alt="简体中文版自述文件" src="https://img.shields.io/badge/简体中文-blue"></a>
  <a href="./README_JA.md"><img alt="日本語のREADME" src="https://img.shields.io/badge/日本語-blue"></a>
  <a href="./README_KR.md"><img alt="한국어 README" src="https://img.shields.io/badge/한국어-blue"></a>
  <a href="./README_DE.md"><img alt="독일어 README" src="https://img.shields.io/badge/Deutsch-blue"></a>
  <a href="./README_FR.md"><img alt="프랑스어 README" src="https://img.shields.io/badge/Français-blue"></a>
  <a href="./README_ES.md"><img alt="스페인어 README" src="https://img.shields.io/badge/Español-blue"></a>
</p>

<p align="center">
  <a href="https://docs.pyspur.dev/" target="_blank">
    <img alt="문서" src="https://img.shields.io/badge/Docs-green.svg?style=for-the-badge&logo=readthedocs&logoColor=white">
  </a>
  <a href="https://calendly.com/d/cnf9-57m-bv3/pyspur-founders" target="_blank">
    <img alt="만나기" src="https://img.shields.io/badge/Meet%20us-blue.svg?style=for-the-badge&logo=calendly&logoColor=white">
  </a>
  <a href="https://forms.gle/5wHRctedMpgfNGah7" target="_blank">
    <img alt="클라우드" src="https://img.shields.io/badge/Cloud-orange.svg?style=for-the-badge&logo=cloud&logoColor=white">
  </a>
  <a href="https://discord.gg/7Spn7C8A5F">
    <img alt="디스코드 참여" src="https://img.shields.io/badge/Discord-7289DA.svg?style=for-the-badge&logo=discord&logoColor=white">
  </a>
</p>

https://github.com/user-attachments/assets/1ebf78c9-94b2-468d-bbbb-566311df16fe

# 🕸️ 왜 PySpur인가?

- 🖐️ **드래그 앤 드롭**: 몇 초 안에 구축, 테스트 및 반복 진행.
- 🔄 **루프**: 메모리를 활용한 반복적 도구 호출.
- 📤 **파일 업로드**: 파일을 업로드하거나 URL을 붙여넣어 문서를 처리.
- 📋 **구조화된 출력**: JSON 스키마용 UI 편집기.
- 🗃️ **RAG**: 데이터를 파싱, 청킹, 임베딩 및 벡터 DB에 업서트.
- 🖼️ **멀티모달**: 비디오, 이미지, 오디오, 텍스트, 코드 지원.
- 🧰 **도구**: Slack, Firecrawl.dev, Google Sheets, GitHub 등.
- 🧪 **평가**: 실제 데이터셋에서 에이전트 평가.
- 🚀 **원클릭 배포**: API로 발행하여 원하는 곳에 통합.
- 🐍 **파이썬 기반**: 단일 파이썬 파일 생성으로 새 노드 추가.
- 🎛️ **모든 벤더 지원**: 100개 이상의 LLM 제공업체, 임베더, 벡터 DB 지원.

# ⚡ 빠른 시작

## 옵션 A: `pyspur` 파이썬 패키지 사용

시작하는 가장 빠른 방법입니다. 파이썬 3.12 이상이 필요합니다.

1. **PySpur 설치:**
    ```sh
    pip install pyspur
    ```

2. **새 프로젝트 초기화:**
    ```sh
    pyspur init my-project
    cd my-project
    ```
    새 디렉토리와 함께 `.env` 파일이 생성됩니다.

3. **서버 시작:**
    ```sh
    pyspur serve --sqlite
    ```
    기본적으로 SQLite 데이터베이스를 사용하여 `http://localhost:6080`에서 PySpur 앱이 시작됩니다.
    보다 안정적인 사용을 위해 `.env` 파일에 PostgreSQL 인스턴스 URL을 설정하는 것을 권장합니다.

4. **[선택 사항] 배포 맞춤 설정:**
    PySpur 배포는 두 가지 방법으로 맞춤 설정할 수 있습니다:

    a. **앱을 통한 설정** (권장):
       - 앱의 API 키 탭으로 이동
       - 다양한 제공업체(OpenAI, Anthropic 등)의 API 키를 추가
       - 변경 사항이 즉시 적용됨

    b. **수동 설정:**
       - 프로젝트 디렉토리 내의 `.env` 파일을 수정
       - 보다 안정적인 사용을 위해 `.env` 파일에 PostgreSQL 데이터베이스 설정을 권장
       - PostgreSQL을 사용하지 않을 경우 `--sqlite` 옵션을 추가하여 `pyspur serve` 명령어로 앱을 재시작

## 옵션 B: Docker 사용 (확장 가능, 운영 환경에 적합)

운영 환경 배포에 권장되는 방법입니다:

1. **Docker 설치:**
    먼저, 사용 중인 운영 체제에 맞는 공식 설치 가이드를 따라 Docker를 설치하세요:
    - [Docker for Linux](https://docs.docker.com/engine/install/)
    - [Docker Desktop for Mac](https://docs.docker.com/desktop/install/mac-install/)

2. **PySpur 프로젝트 생성:**
    Docker 설치 후, 다음 명령어로 새로운 PySpur 프로젝트를 생성합니다:
    ```sh
    curl -fsSL https://raw.githubusercontent.com/PySpur-com/pyspur/main/start_pyspur_docker.sh | bash -s pyspur-project
    ```
    이 명령어는:
    - `pyspur-project`라는 새 디렉토리에서 PySpur 프로젝트를 시작하고,
    - 필요한 구성 파일들을 설정하며,
    - 로컬 PostgreSQL Docker 인스턴스를 백엔드로 하여 PySpur 앱을 자동으로 시작합니다.

3. **PySpur 접속:**
    브라우저에서 `http://localhost:6080`으로 접속합니다.

4. **[선택 사항] 배포 맞춤 설정:**
    PySpur 배포는 두 가지 방법으로 맞춤 설정할 수 있습니다:

    a. **앱을 통한 설정** (권장):
       - 앱의 API 키 탭으로 이동
       - 다양한 제공업체(OpenAI, Anthropic 등)의 API 키를 추가
       - 변경 사항이 즉시 적용됨

    b. **수동 설정:**
       - 프로젝트 디렉토리 내의 `.env` 파일을 수정
       - 다음 명령어로 서비스를 재시작:
         ```sh
         docker compose up -d
         ```

이제 끝입니다! "New Spur"을 클릭하여 워크플로우를 생성하거나 기본 템플릿 중 하나로 시작하세요.

# ✨ 핵심 이점

## 노드 레벨에서 디버그:

https://github.com/user-attachments/assets/6e82ad25-2a46-4c50-b030-415ea9994690

## 멀티모달 (파일 업로드 또는 URL 붙여넣기)

PDF, 비디오, 오디오, 이미지, ...

https://github.com/user-attachments/assets/83ed9a22-1ec1-4d86-9dd6-5d945588fd0b

## 루프

<img width="1919" alt="Loops" src="https://github.com/user-attachments/assets/3aea63dc-f46f-46e9-bddd-e2af9c2a56bf" />

## RAG

### 1단계) 문서 컬렉션 생성 (청킹 + 파싱)

https://github.com/user-attachments/assets/c77723b1-c076-4a64-a01d-6d6677e9c60e

### 2단계) 벡터 인덱스 생성 (임베딩 + 벡터 DB 업서트)

https://github.com/user-attachments/assets/50e5c711-dd01-4d92-bb23-181a1c5bba25

## 모듈형 빌딩 블록

https://github.com/user-attachments/assets/6442f0ad-86d8-43d9-aa70-e5c01e55e876

## 최종 성능 평가

https://github.com/user-attachments/assets/4dc2abc3-c6e6-4d6d-a5c3-787d518de7ae

## 곧 추가될 기능: 자기 개선

https://github.com/user-attachments/assets/5bef7a16-ef9f-4650-b385-4ea70fa54c8a

# 🛠️ PySpur 개발 환경 설정
#### [ 유닉스 계열 시스템 개발 지침. Windows/PC 개발은 지원되지 않음 ]

개발을 위해 아래 단계를 따르세요:

1. **리포지토리 클론:**
    ```sh
    git clone https://github.com/PySpur-com/pyspur.git
    cd pyspur
    ```

2. **docker-compose.dev.yml 사용하여 실행:**
    ```sh
    docker compose -f docker-compose.dev.yml up --build -d
    ```
    이 명령어는 개발용 핫 리로딩이 활성화된 로컬 PySpur 인스턴스를 시작합니다.

3. **환경 설정 맞춤:**
    환경 구성을 위해 `.env` 파일을 수정합니다. 기본적으로 PySpur는 로컬 PostgreSQL 데이터베이스를 사용합니다. 외부 데이터베이스를 사용하려면 `.env` 파일의 `POSTGRES_*` 변수를 수정하세요.

# ⭐ 지원해 주세요

별을 남겨 주셔서 저희의 작업을 지원하실 수 있습니다! 감사합니다!

![star](https://github.com/user-attachments/assets/71f65273-6755-469d-be44-087bb89d5e76)

여러분의 피드백은 큰 힘이 됩니다.
다음에 보고 싶은 기능이나 완전히 새로운 기능 요청이 있다면 [알려주세요](mailto:founders@pyspur.dev?subject=Feature%20Request&body=I%20want%20this%20feature%3Ai).