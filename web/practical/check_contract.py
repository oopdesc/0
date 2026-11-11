"""Check a learner-designed GET contract against an explicitly started loopback API."""
import argparse
import ipaddress
import json
from pathlib import Path
import re
import sys
import urllib.error
import urllib.parse
import urllib.request


def base_url(raw):
    parsed = urllib.parse.urlsplit(raw)
    try:
        host = ipaddress.ip_address(parsed.hostname or "")
        port = parsed.port
    except ValueError as error:
        raise ValueError("Use an IP loopback address and a valid port") from error
    if (parsed.scheme != "http" or not host.is_loopback or not port or
            parsed.username is not None or parsed.password is not None or parsed.query or parsed.fragment or
            parsed.path not in ["", "/"]):
        raise ValueError("Only http://127.0.0.1:PORT or http://[::1]:PORT is supported; no credentials or extra path")
    return raw.rstrip("/")


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def validate_suite(value):
    if not isinstance(value, dict) or value.get("schema") != "zero-http-contract/1":
        raise ValueError("Unknown suite format")
    cases = value.get("cases")
    if not isinstance(cases, list) or not 1 <= len(cases) <= 12:
        raise ValueError("Expected 1..12 cases")
    for case in cases:
        if (not isinstance(case, dict) or
                any(not isinstance(case.get(k), str) or len(case[k]) > 80 for k in ["name", "id", "title"]) or
                case.get("repository") not in ["ready", "down"] or
                type(case.get("status")) is not int or case["status"] not in [200, 400, 404, 500] or
                type(case.get("safeError")) is not bool or
                type(case.get("successShape", False)) is not bool):
            raise ValueError("Malformed test case")
    return cases


def check(case, status, body):
    errors = []
    if status != case["status"]:
        errors.append(f"status expected {case['status']}, got {status}")
    if not isinstance(body, dict):
        return errors + ["expected a JSON object"]
    if case["title"] and body.get("title") != case["title"]:
        errors.append("title differs from expected value")
    if case.get("successShape") and status == 200:
        try:
            expected_id = int(case["id"])
        except ValueError:
            expected_id = None
        if type(body.get("id")) not in [int, float] or body["id"] != expected_id:
            errors.append("id differs or is not a number")
        if type(body.get("version")) not in [int, float] or body["version"] != 1:
            errors.append("version must be the number 1 in this fixture")
    if case["safeError"] and status >= 400:
        if not isinstance(body.get("requestId"), str) or not body["requestId"]:
            errors.append("missing string requestId")
        error = body.get("error")
        if not isinstance(error, str) or re.search(r"SQLITE_|private/|Exception|SELECT ", error, re.I):
            errors.append("missing generic error or internal details exposed")
    return errors


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("base", help="Explicit learning server origin, e.g. http://127.0.0.1:18423")
    parser.add_argument("--cases", default="contract-suite.json")
    parser.add_argument("--repository", choices=["ready", "down"], default="ready", help="Select matching cases only; does not change or stop a server")
    args = parser.parse_args(argv)
    origin = base_url(args.base)
    path = Path(args.cases)
    if path.is_symlink() or not path.is_file() or path.stat().st_size > 65536:
        raise ValueError("Expected an ordinary suite JSON file smaller than 64KiB")
    cases = validate_suite(json.loads(path.read_text(encoding="utf-8")))
    # No system proxy, cookies, credentials, or redirection to another destination.
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    passed = failed = skipped = 0
    for index, case in enumerate(cases, 1):
        if case["repository"] != args.repository:
            skipped += 1
            continue
        request = urllib.request.Request(origin + "/api/books/" + urllib.parse.quote(case["id"], safe=""), headers={"Accept": "application/json", "User-Agent": "zero-learning-contract-check"}, method="GET")
        try:
            try:
                response = opener.open(request, timeout=5)
            except urllib.error.HTTPError as error:
                response = error
            with response:
                raw = response.read(65537)
                if len(raw) > 65536:
                    raise ValueError("response exceeds 64KiB")
                def reject_constant(_value):
                    raise ValueError("not a valid JSON number")
                errors = check(case, response.code, json.loads(raw.decode("utf-8"), parse_constant=reject_constant))
            if errors:
                failed += 1
                print(f"FAIL {index} {case['name']}: {'; '.join(errors)}")
            else:
                passed += 1
                print(f"PASS {index} {case['name']}")
        except (OSError, ValueError) as error:
            failed += 1
            print(f"FAIL {index} {case['name']}: {type(error).__name__}")
    print(f"{passed} passed, {failed} failed, {skipped} skipped (repository={args.repository})")
    print("Only this GET contract was checked. This is not a release approval or a security audit.")
    return 2 if passed + failed == 0 else 1 if failed else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError) as error:
        print(f"Configuration error: {error}", file=sys.stderr)
        sys.exit(2)
