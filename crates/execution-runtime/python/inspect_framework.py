"""Static framework inspection only. Never import, evaluate or execute framework.py."""
import ast
import json
import os
import platform
import sys

sys.path.insert(0, os.getcwd())
from validation import parse_source


def check(code, status="unknown", reason="not_checked", line=None):
    return {"code": code, "status": status, "reason": reason, "line": line}


def entry_check(tree):
    entry = next((n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == "BlackBoxCase"), None)
    if entry:
        modules = set()
        bases = set()
        for node in tree.body:
            if isinstance(node, ast.Import):
                modules.update(n.asname or n.name for n in node.names if n.name == "unittest")
            if isinstance(node, ast.ImportFrom) and node.module == "unittest" and not node.level:
                bases.update(n.asname or n.name for n in node.names if n.name == "TestCase")
        direct = any(
            isinstance(base, ast.Name) and base.id in bases or
            isinstance(base, ast.Attribute) and isinstance(base.value, ast.Name) and
            base.value.id in modules and base.attr == "TestCase"
            for base in entry.bases
        )
        return check("entry", "ok" if direct else "unknown", "entry_declared" if direct else "entry_unverified_base", entry.lineno)
    indirect = any(
        isinstance(node, (ast.ClassDef, ast.FunctionDef)) and node.name in {"BlackBoxCase", "__getattr__"} or
        isinstance(node, ast.Name) and node.id == "BlackBoxCase" and isinstance(node.ctx, ast.Store) or
        isinstance(node, ast.alias) and (node.asname or node.name) in {"BlackBoxCase", "*"}
        for node in ast.walk(tree)
    )
    return check("entry", "unknown" if indirect else "error", "entry_dynamic" if indirect else "entry_missing")


def source_hints(tree):
    hints = {}
    entry = next((n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == "BlackBoxCase"), None)
    if entry:
        for node in entry.body:
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name in {"setUp", "tearDown"}:
                hints.setdefault("setup_declared" if node.name == "setUp" else "teardown_declared", node.lineno)
    for node in ast.walk(tree):
        if isinstance(node, ast.Constant) and node.value in ("BLACKBOX_BASE_URL", "BLACKBOX_EVIDENCE_FILE"):
            code = "target_env_mentioned" if node.value == "BLACKBOX_BASE_URL" else "evidence_env_mentioned"
            hints.setdefault(code, node.lineno)
    return [{"code": code, "line": line} for code, line in sorted(hints.items())]


def inspect_source(source):
    checks = [check("python", "ok" if sys.version_info >= (3, 11) else "error", "python_supported" if sys.version_info >= (3, 11) else "python_version_unsupported"),
              check("syntax"), check("limits"), check("entry")]
    report = {"version": 1, "pythonVersion": platform.python_version(), "checks": checks, "hints": []}
    if sys.version_info < (3, 11):
        return report
    try:
        tree = parse_source(source)
    except SyntaxError as error:
        checks[1] = check("syntax", "error", "syntax_error", error.lineno)
        return report
    except ValueError as error:
        code = str(error) if str(error) in {"script_file_limit", "script_function_limit"} else "not_checked"
        checks[2] = check("limits", "error", code)
        return report
    checks[1] = check("syntax", "ok", "syntax_valid")
    checks[2] = check("limits", "ok", "limits_valid")
    checks[3] = entry_check(tree)
    report["hints"] = source_hints(tree)
    return report


if __name__ == "__main__":
    with open("framework.py", encoding="utf-8") as stream:
        report = inspect_source(stream.read())
    with open("preflight.json", "w", encoding="utf-8") as stream:
        json.dump(report, stream, ensure_ascii=False)
