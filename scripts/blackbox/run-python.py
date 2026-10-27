"""Validate the generated script before running it against the controlled fixture.

AST checks and a process deadline reduce accidental actions; this is not an OS sandbox.
"""
import ast
import importlib.util
import json
import os
import sys
import unittest


def validate(source):
    if len(source.splitlines()) > 2000:
        raise ValueError("script_file_limit")
    tree = ast.parse(source)
    forbidden = {"exec", "eval", "compile", "open", "__import__", "getattr", "setattr", "delattr", "globals", "locals", "vars", "input", "breakpoint"}
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)) and node.end_lineno - node.lineno + 1 > 200:
            raise ValueError("script_function_limit")
        if isinstance(node, ast.Import) and any(item.name not in {"unittest", "framework"} for item in node.names):
            raise ValueError("unapproved_import")
        if isinstance(node, ast.ImportFrom) and (node.module not in {"unittest", "framework"} or node.level):
            raise ValueError("unapproved_import")
        if isinstance(node, ast.Name) and node.id in forbidden:
            raise ValueError("unapproved_builtin")
        if isinstance(node, ast.Attribute) and node.attr.startswith("__"):
            raise ValueError("unapproved_attribute")
    return tree


def run():
    script, output = sys.argv[1:3]
    with open(script, encoding="utf-8") as stream:
        validate(stream.read())
    sys.path.insert(0, os.path.dirname(os.path.abspath(script)))
    spec = importlib.util.spec_from_file_location("test_game_platform", script)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    suite = unittest.defaultTestLoader.loadTestsFromModule(module)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    summary = {"total": result.testsRun, "failures": [{"test": test.id(), "trace": trace} for test, trace in result.failures], "errors": [{"test": test.id(), "trace": trace} for test, trace in result.errors], "skipped": len(result.skipped)}
    with open(output, "w", encoding="utf-8") as stream:
        json.dump(summary, stream, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    run()
