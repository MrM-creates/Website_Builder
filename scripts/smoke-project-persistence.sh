#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://127.0.0.1:3001}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing command: $1" >&2
    exit 1
  fi
}

require_cmd curl
require_cmd jq

tmp_root="$(mktemp -d "/tmp/flatsite-smoke-XXXXXX")"
cleanup() {
  rm -rf "$tmp_root"
}
trap cleanup EXIT

json_post() {
  local endpoint="$1"
  local payload="$2"
  curl -sS -X POST -H 'Content-Type: application/json' -d "$payload" "${API_URL}${endpoint}"
}

json_get() {
  local endpoint="$1"
  curl -sS "${API_URL}${endpoint}"
}

open_project() {
  local project_path="$1"
  local payload
  payload="$(jq -n --arg path "$project_path" '{projectPath:$path}')"
  local response
  response="$(json_post "/api/projects/open" "$payload")"
  local success
  success="$(echo "$response" | jq -r '.success // false')"
  if [[ "$success" != "true" ]]; then
    echo "failed: open project at $project_path" >&2
    echo "$response" >&2
    exit 1
  fi
}

sync_pages() {
  local pages_json="$1"
  local payload
  payload="$(jq -n --argjson pages "$pages_json" '{pages:$pages}')"
  local response
  response="$(json_post "/api/sync-pages" "$payload")"
  local success
  success="$(echo "$response" | jq -r '.success // false')"
  if [[ "$success" != "true" ]]; then
    echo "failed: sync pages" >&2
    echo "$response" >&2
    exit 1
  fi
}

save_state() {
  local project_id="$1"
  local project_name="$2"
  local payload
  payload="$(jq -n --arg id "$project_id" --arg name "$project_name" '
{
  projectId: $id,
  state: {
    projectName: $name,
    selectedDesign: "minimalist",
    selectedVibeId: "M-01",
    setupDone: true,
    isLive: false
  }
}')"
  local response
  response="$(json_post "/api/projects/save" "$payload")"
  local success
  success="$(echo "$response" | jq -r '.success // false')"
  if [[ "$success" != "true" ]]; then
    echo "failed: save state for $project_name" >&2
    echo "$response" >&2
    exit 1
  fi
}

assert_content_contains() {
  local page_id="$1"
  local response
  response="$(json_get "/api/content-pages")"
  local success
  success="$(echo "$response" | jq -r '.success // false')"
  if [[ "$success" != "true" ]]; then
    echo "failed: read content pages" >&2
    echo "$response" >&2
    exit 1
  fi

  local matches
  matches="$(echo "$response" | jq -r --arg id "$page_id" '.pages[]?.id | select(. == $id)' | wc -l | tr -d ' ')"
  if [[ "$matches" != "1" ]]; then
    echo "failed: expected page id '$page_id' in content-pages" >&2
    echo "$response" >&2
    exit 1
  fi
}

echo "smoke: create project A"
allocate_a="$(json_post "/api/projects/allocate-path" "$(jq -n --arg root "$tmp_root" '{rootPath:$root}')")"
path_a="$(echo "$allocate_a" | jq -r '.projectPath // empty')"
if [[ -z "$path_a" ]]; then
  echo "failed: allocate project A path" >&2
  exit 1
fi

create_a_payload="$(jq -n --arg path "$path_a" '
{
  projectPath: $path,
  state: {
    projectName: "Smoke Alpha",
    selectedDesign: "minimalist",
    selectedVibeId: "M-01",
    setupDone: true,
    isLive: false
  }
}')"
create_a="$(json_post "/api/projects/create" "$create_a_payload")"
id_a="$(echo "$create_a" | jq -r '.project.id // empty')"
path_a="$(echo "$create_a" | jq -r '.project.path // empty')"
if [[ -z "$id_a" ]]; then
  echo "failed: create project A" >&2
  echo "$create_a" >&2
  exit 1
fi
if [[ -z "$path_a" ]]; then
  echo "failed: create project A returned no path" >&2
  echo "$create_a" >&2
  exit 1
fi

echo "smoke: sync canonical pages for project A"
open_project "$path_a"
sync_pages '[{"slug":"portfolio","title":"Portfolio"},{"slug":"about","title":"About"},{"slug":"contact","title":"Contact"},{"slug":"alpha-extra","title":"Alpha Extra"}]'
save_state "$id_a" "Smoke Alpha"
open_project "$path_a"
assert_content_contains "alpha-extra"

echo "smoke: create and open project B"
allocate_b="$(json_post "/api/projects/allocate-path" "$(jq -n --arg root "$tmp_root" '{rootPath:$root}')")"
path_b="$(echo "$allocate_b" | jq -r '.projectPath // empty')"
if [[ -z "$path_b" ]]; then
  echo "failed: allocate project B path" >&2
  exit 1
fi

create_b_payload="$(jq -n --arg path "$path_b" '
{
  projectPath: $path,
  state: {
    projectName: "Smoke Beta",
    selectedDesign: "minimalist",
    selectedVibeId: "M-01",
    setupDone: true,
    isLive: false
  }
}')"
create_b="$(json_post "/api/projects/create" "$create_b_payload")"
id_b="$(echo "$create_b" | jq -r '.project.id // empty')"
path_b="$(echo "$create_b" | jq -r '.project.path // empty')"
if [[ -z "$id_b" ]]; then
  echo "failed: create project B" >&2
  echo "$create_b" >&2
  exit 1
fi
if [[ -z "$path_b" ]]; then
  echo "failed: create project B returned no path" >&2
  echo "$create_b" >&2
  exit 1
fi

echo "smoke: sync canonical pages for project B"
open_project "$path_b"
sync_pages '[{"slug":"portfolio","title":"Portfolio"},{"slug":"beta-extra","title":"Beta Extra"}]'
save_state "$id_b" "Smoke Beta"
open_project "$path_b"
assert_content_contains "beta-extra"

echo "smoke: reopen project A after switching"
open_project "$path_a"
assert_content_contains "alpha-extra"

echo "smoke: ok"
