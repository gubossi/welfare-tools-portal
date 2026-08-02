# Welmoa GA4 이벤트 설계

## 목적

Welmoa의 기존 참여도(engagement) 이벤트는 유지하면서, 앞으로 추가되는 모든 도구의 시작·완료·오류를 같은 기준으로 분석한다.

- 스키마 버전: `1.0`
- 적용 시작일: 2026-08-03
- GA4 속성: Welmoa Main
- 개인정보, 자유 입력 원문, 급여 금액 등 민감하거나 불필요한 값은 전송하지 않는다.

## 공통 이벤트

| 이벤트 | 발생 시점 | 주요 용도 |
|---|---|---|
| `tool_start` | 사용자가 계산·생성·변환 등 핵심 작업을 시작할 때 | 도구 진입 대비 실제 사용률 |
| `tool_complete` | 핵심 작업이 정상적으로 끝났을 때 | 완료율, 도구별 성공 사용량 |
| `tool_error` | 시작된 핵심 작업이 오류로 끝났을 때 | 오류율, 장애 탐지 |

페이지 조회나 단순 스크롤은 `tool_start`로 보지 않는다. 한 번의 작업 흐름에서 각 이벤트는 최대 한 번만 전송한다. 재계산이나 초기화 후 새 작업은 새로운 `flow_id`를 사용한다.

## 공통 매개변수

| 매개변수 | 형식 | 필수 | 설명 | 예시 |
|---|---|---:|---|---|
| `schema_version` | string | O | 이벤트 스키마 버전 | `1.0` |
| `tool_id` | string | O | 변하지 않는 도구 식별자 | `salary`, `hobong` |
| `tool_name` | string | O | 사람이 읽는 도구명 | `salary_calculator` |
| `tool_version` | string | O | 도구 이벤트 구현 버전 | `1.0` |
| `tool_action` | string | O | 수행한 핵심 작업 | `calculate` |
| `flow_id` | string | O | 한 번의 시작-종료 흐름 식별자 | UUID 또는 임의 ID |
| `duration_ms` | number | 완료·오류 | 시작부터 종료까지 걸린 시간 | `842` |
| `error_code` | string | 오류 | 정규화된 오류 코드 | `calculation_failed` |
| `error_message` | string | 오류 | 100자 이하의 비민감 오류 요약 | `request failed` |

도구별 추가 매개변수는 GA4 제한에 맞는 영문 snake_case를 사용한다. 사용자 이름, 전화번호, 기관명, 경력 상세 문장, 금액 등은 포함하지 않는다.

## 현재 적용

### 급여계산기

- `tool_id`: `salary`
- `tool_action`: `calculate`
- 시작: 계산하기 버튼을 누른 직후
- 완료: 계산 API 응답을 받아 결과가 표시된 직후
- 오류: 계산 API 또는 렌더링 오류 발생 시
- 추가 매개변수: `year`, `facility_type`, `grade`, `step`, `include_deductions`, `include_tax`, `has_overtime`

### 호봉계산기

- `tool_id`: `hobong`
- `tool_action`: `calculate`
- 시작: 계산기 안에서 최초 입력·선택·버튼 조작 시
- 완료: 예상 호봉 결과가 처음 표시될 때
- 오류: 시작 후 런타임 오류 또는 처리되지 않은 Promise 오류 발생 시

## 기존 이벤트와의 호환성

기존 engagement 이벤트는 이름과 발생 조건을 변경하지 않는다.

`salary_calculate`는 즉시 제거하지 않고 전환 기간 동안 `tool_complete`와 함께 전송한다. 기존 이벤트에는 `migration_source: "tool_events_v1"`을 추가해 새 코드에서 발생한 이중 전송임을 구분한다.

권장 전환 절차:

1. 최소 4주 동안 `salary_calculate`와 `tool_complete`를 함께 수집한다.
2. 같은 기간·같은 페이지에서 `tool_id=salary`인 `tool_complete`와 `salary_calculate` 건수를 비교한다.
3. 2주 연속 건수 차이가 5% 이내이고 `tool_error`가 정상적으로 확인되면 새 이벤트가 안정화된 것으로 판단한다.
4. 기존 GA4 탐색 보고서와 대시보드를 `tool_complete` 기준으로 변경한다.
5. 그 다음 배포에서 `salary_calculate` 전송을 제거한다. 과거 데이터는 그대로 보존한다.

기존 `salary_csv_download`처럼 공통 3종 이벤트와 목적이 다른 보조 행동 이벤트는 당분간 유지한다. 추후 `tool_export`, `tool_share` 등의 별도 공통 규격이 필요할 때 일괄 정리한다.

## GA4 사용자 정의 측정기준 권장값

이벤트 범위로 다음 항목을 등록한다.

- `schema_version`
- `tool_id`
- `tool_name`
- `tool_version`
- `tool_action`
- `error_code`

`flow_id`는 카디널리티가 높으므로 일반 보고서용 사용자 정의 측정기준으로 등록하지 않고 BigQuery 또는 디버깅 용도로만 사용한다. `duration_ms`는 이벤트 범위 사용자 정의 측정항목으로 등록할 수 있다.

## 새 도구 적용 체크리스트

1. 고유하고 변하지 않는 `tool_id`를 정한다.
2. 페이지 조회가 아닌 최초 핵심 행동에서 `tool_start`를 보낸다.
3. 실제 결과가 만들어진 뒤에만 `tool_complete`를 보낸다.
4. 시작된 작업이 실패하면 `tool_error`를 보낸다.
5. 한 흐름에서 완료와 오류를 동시에 보내지 않는다.
6. 기존 이벤트가 있으면 최소 4주간 이중 전송 후 비교 검증한다.
7. GA4 DebugView에서 이벤트 순서와 매개변수를 확인한다.
