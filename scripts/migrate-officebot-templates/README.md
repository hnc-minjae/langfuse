# officebot-storage → Langfuse 프롬프트 마이그레이션

officebot-storage의 template.json 파일들을 Langfuse 프롬프트로 일괄 마이그레이션하는 CLI 스크립트입니다.

## 사용법

```bash
# Dry-run (업로드 없이 변환 결과만 확인)
./worker/node_modules/.bin/tsx scripts/migrate-officebot-templates/index.ts \
  --source /path/to/aihub-officebot-storage \
  --dry-run

# 실제 업로드
./worker/node_modules/.bin/tsx scripts/migrate-officebot-templates/index.ts \
  --source /path/to/aihub-officebot-storage \
  --langfuse-host http://localhost:3000 \
  --langfuse-public-key pk_... \
  --langfuse-secret-key sk_...

# 특정 제품/템플릿만
./worker/node_modules/.bin/tsx scripts/migrate-officebot-templates/index.ts \
  --source /path/to/aihub-officebot-storage \
  --langfuse-host http://localhost:3000 \
  --langfuse-public-key pk_... \
  --langfuse-secret-key sk_... \
  --products assistant,groupware \
  --template generate-draft-plan-multi
```

## CLI 옵션

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--source`, `-s` | ✅ | officebot-storage 루트 경로 |
| `--langfuse-host` | | Langfuse 호스트 (기본: `http://localhost:3000`) |
| `--langfuse-public-key` | * | Langfuse Public Key (dry-run 아닐 때 필수) |
| `--langfuse-secret-key` | * | Langfuse Secret Key (dry-run 아닐 때 필수) |
| `--products`, `-p` | | 특정 제품만 (쉼표 구분: `assistant,groupware`) |
| `--template`, `-t` | | 특정 templateId만 |
| `--dry-run` | | 업로드 없이 변환 결과만 출력 |

## 파일 구조

```
scripts/migrate-officebot-templates/
├── index.ts          # CLI 진입점
├── scanner.ts        # officebot-storage 스캔, template.json 수집
├── transformer.ts    # promptInfos → Langfuse 프롬프트 변환
├── uploader.ts       # Langfuse API로 업로드
├── types.ts          # 타입 정의
└── README.md
```

## 변환 규칙

### 네이밍
- General/Chat: `{templateId}/{locale}/{model}`
- Sequential: `{templateId}/{locale}/{model}/step-{N}`
- Multiple: `{templateId}/{locale}/{model}/task-{N}`

### 변수 변환
- officebot: `{var}` → Langfuse: `{{var}}`

### 프롬프트 본문
```
{instruction}

{separator (기본: ###)}

{context}
```

### Config
모델 파라미터 + `_meta` 필드에 templateId, templateType, outputKey, outputParser 등 메타데이터를 보존합니다.
