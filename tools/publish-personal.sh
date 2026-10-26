#!/bin/zsh
set -eu
ROOT="$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)"
case "$ROOT" in *'/['*) print -u2 'Private location refused'; exit 1;; esac
cd "$ROOT"
[[ "$(git rev-parse --show-toplevel)" == "$ROOT" ]] || { print -u2 'Repository root mismatch'; exit 1; }
REMOTE="$(git remote get-url origin)"
[[ "$REMOTE" == 'https://github.com/oopdesc/0.git' || "$REMOTE" == 'git@github.com:oopdesc/0.git' ]] || { print -u2 'This launcher is restricted to the 0 repository'; exit 1; }
BRANCH="$(git symbolic-ref --quiet --short HEAD)" || { print -u2 'Choose a working branch first'; exit 1; }
case "${1:-status}" in
  status) git status --short; print "Current branch: $BRANCH" ;;
  push)
    [[ "$BRANCH" != main && "$BRANCH" != master ]] || { print -u2 'Use a working branch and a Pull Request for production'; exit 1; }
    [[ -z "$(git status --porcelain --untracked-files=normal)" ]] || { print -u2 'Review and commit the selected source changes before pushing'; exit 1; }
    exec git push -u origin "$BRANCH" ;;
  compare)
    [[ "$BRANCH" != main && "$BRANCH" != master ]] || { print -u2 'Create a working branch first'; exit 1; }
    ENCODED="$(/usr/bin/python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1],safe=""))' "$BRANCH")"
    exec /usr/bin/open "https://github.com/oopdesc/0/compare/main...$ENCODED?expand=1" ;;
  *) print 'Usage: publish-personal.sh status | push | compare'; exit 1 ;;
esac
