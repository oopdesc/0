"""Small loopback checks of the exported contract verifier; never tests a user server."""
from contextlib import redirect_stdout
from http.server import BaseHTTPRequestHandler, HTTPServer
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import threading
import unittest

root = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("contract_runner", root / "web/practical/check_contract.py")
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class ContractChecks(unittest.TestCase):
    def case(self, raw="1", status=200, **extra):
        return {"name": "local fixture", "id": raw, "repository": "ready", "status": status, "title": "Java" if status == 200 else "", "safeError": True, "successShape": True, **extra}

    def test_destination_is_explicit_loopback_without_credentials(self):
        self.assertEqual(runner.base_url("http://127.0.0.1:18080/"), "http://127.0.0.1:18080")
        self.assertEqual(runner.base_url("http://[::1]:18080"), "http://[::1]:18080")
        for url in ["https://127.0.0.1:18080", "http://example.com:80", "http://localhost:18080", "http://127.0.0.1:18080/x", "http://a:b@127.0.0.1:18080", "http://@127.0.0.1:18080", "http://127.0.0.1:18080?q=x"]:
            with self.assertRaises(ValueError):
                runner.base_url(url)

    def test_success_values_and_error_privacy_are_distinct(self):
        self.assertEqual(runner.check(self.case(), 200, {"id": 1.0, "title": "Java", "version": 1.0}), [])
        self.assertTrue(runner.check(self.case(), 200, {"id": True, "title": "Java", "version": 1}))
        self.assertTrue(runner.check(self.case("abc", 400), 400, {"error": "SQLITE_CANTOPEN: /private/file", "requestId": "test"}))
        self.assertEqual(runner.check(self.case("abc", 400), 400, {"error": "invalid id", "requestId": "test"}), [])
        with self.assertRaises(ValueError):
            runner.validate_suite({"schema": "zero-http-contract/1", "cases": [self.case(status=True)]})

    def test_real_http_matches_mismatch_skip_and_redirect_without_following(self):
        requests = []

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def do_GET(self):
                requests.append(self.path)
                if self.path.endswith("redirect"):
                    self.send_response(302)
                    self.send_header("Location", f"http://127.0.0.1:{self.server.server_port}/should-not-be-read")
                    self.end_headers()
                    self.wfile.write(b"{}")
                    return
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"id":1,"title":"Java","version":1}')

        server = HTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        origin = f"http://127.0.0.1:{server.server_port}"
        try:
            with tempfile.TemporaryDirectory(prefix="zero-contract-test-") as folder:
                path = Path(folder) / "suite.json"

                def invoke(case, mode="ready"):
                    path.write_text(json.dumps({"schema": "zero-http-contract/1", "cases": [case]}), encoding="utf-8")
                    output = io.StringIO()
                    with redirect_stdout(output):
                        code = runner.main([origin, "--cases", str(path), "--repository", mode])
                    return code, output.getvalue()

                code, text = invoke(self.case())
                self.assertEqual(code, 0)
                self.assertIn("1 passed, 0 failed", text)
                self.assertEqual(invoke(self.case(status=404))[0], 1)
                previous = len(requests)
                code, text = invoke(self.case(repository="down"))
                self.assertEqual(code, 2)
                self.assertIn("1 skipped", text)
                self.assertEqual(len(requests), previous)
                self.assertEqual(invoke(self.case("redirect"))[0], 1)
                self.assertNotIn("/should-not-be-read", requests)
        finally:
            server.shutdown()
            thread.join(timeout=2)
            server.server_close()


if __name__ == "__main__":
    unittest.main(verbosity=2)
