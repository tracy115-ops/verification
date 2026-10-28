"""Fixed local runner. Framework source is trusted code explicitly reviewed by the user."""
import importlib.util
import json
import os
import platform
import sys
import traceback
import unittest

sys.path.insert(0, os.getcwd())
from validation import validate


class Result(unittest.TestResult):
    def __init__(self):
        super().__init__()
        self.records = []
        self.active = None

    def startTest(self, test):
        super().startTest(test)
        self.active = {"testName": test._testMethodName, "status": "passed", "details": []}

    def problem(self, status, error):
        if self.active is not None:
            if status == "error" or self.active["status"] == "passed":
                self.active["status"] = status
            self.active["details"].append("".join(traceback.format_exception(*error))[-12000:])

    def addFailure(self, test, error):
        super().addFailure(test, error)
        self.problem("failed", error)

    def addError(self, test, error):
        super().addError(test, error)
        self.problem("error", error)

    def addSubTest(self, test, subtest, error):
        super().addSubTest(test, subtest, error)
        if error:
            self.problem("failed" if issubclass(error[0], test.failureException) else "error", error)

    def addSkip(self, test, reason):
        super().addSkip(test, reason)
        if self.active is not None:
            self.active["status"] = "skipped"
            self.active["details"].append(reason)

    def stopTest(self, test):
        self.records.append(self.active)
        self.active = None
        super().stopTest(test)


def run():
    names = validate()
    if sys.argv[1] == "validate":
        with open("preflight.json", "w", encoding="utf-8") as stream:
            json.dump({"testNames": names, "pythonVersion": platform.python_version()}, stream)
        return
    try:
        spec = importlib.util.spec_from_file_location("test_generated", "test_generated.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        suite = unittest.defaultTestLoader.loadTestsFromModule(module)
        result = Result()
        suite.run(result)
        records = result.records
        executed = [item["testName"] for item in records]
        if any(name not in names for name in executed) or len(executed) != len(set(executed)):
            raise ValueError("execution_test_set_mismatch")
        for name in names:
            if name not in executed:
                records.append({"testName": name, "status": "error", "details": ["test_not_executed: harness setup or teardown failed"]})
    except Exception:
        details = [traceback.format_exc()[-12000:]]
        records = [{"testName": name, "status": "error", "details": details} for name in names]
    with open("result.json", "w", encoding="utf-8") as stream:
        json.dump(records, stream, ensure_ascii=False)


if __name__ == "__main__":
    run()
