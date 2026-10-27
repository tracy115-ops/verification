"""Provided test framework for the local game-platform black-box topic."""
import concurrent.futures
import json
import os
import threading
import unittest
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass


@dataclass
class Response:
    status: int
    body: dict


class GameClient:
    def __init__(self, test_id):
        self.base = os.environ["BLACKBOX_BASE_URL"]
        parsed = urllib.parse.urlsplit(self.base)
        if parsed.scheme != "http" or parsed.hostname != "127.0.0.1":
            raise ValueError("benchmark_target_invalid")
        self.test_id = test_id
        self.lock = threading.Lock()
        self.count = 0

    def call(self, method, path, body=None, user="player-a", headers=None):
        if not path.startswith("/") or path.startswith("//"):
            raise ValueError("benchmark_path_invalid")
        with self.lock:
            self.count += 1
            if self.count > 100:
                raise ValueError("request_limit")
        request_headers = {"Content-Type": "application/json", **(headers or {})}
        if user is not None:
            request_headers["X-Player"] = user
        payload = json.dumps(body).encode() if body is not None else None
        request = urllib.request.Request(self.base + path, data=payload, headers=request_headers, method=method)
        try:
            response = urllib.request.urlopen(request, timeout=3)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            raw = response.read(65537)
            if len(raw) > 65536:
                raise ValueError("response_limit")
            result = Response(response.status, json.loads(raw.decode("utf-8")))
        evidence = {"test": self.test_id, "request": {"method": method, "path": path, "body": body, "user": user, "headers": headers}, "response": {"status": result.status, "body": result.body}}
        with self.lock:
            with open(os.environ["BLACKBOX_EVIDENCE_FILE"], "a", encoding="utf-8") as stream:
                stream.write(json.dumps(evidence, ensure_ascii=False) + "\n")
        return result

    def parallel(self, requests):
        if len(requests) > 4:
            raise ValueError("concurrency_limit")
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            futures = [pool.submit(self.call, **request) for request in requests]
            return [future.result() for future in futures]


class BlackBoxCase(unittest.TestCase):
    def setUp(self):
        self.client = GameClient(self.id())
        self.client.call("POST", "/__fixture/reset", {})
