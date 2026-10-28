"""Shape checks for the single-file unittest adapter; this is not an OS sandbox."""
import ast
import json
import sys


def parse_source(source):
    if len(source.splitlines()) > 2000:
        raise ValueError("script_file_limit")
    tree = ast.parse(source)
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)):
            if node.end_lineno - node.lineno + 1 > 200:
                raise ValueError("script_function_limit")
    return tree


def validate():
    if sys.version_info < (3, 11):
        raise ValueError("python_version_unsupported")
    with open("framework.py", encoding="utf-8") as stream:
        parse_source(stream.read())
    with open("test_generated.py", encoding="utf-8") as stream:
        tree = parse_source(stream.read())
    forbidden = {"exec", "eval", "compile", "open", "__import__", "getattr", "setattr", "delattr", "globals", "locals", "vars", "input", "breakpoint"}
    for node in tree.body:
        if not isinstance(node, (ast.Import, ast.ImportFrom, ast.ClassDef)):
            raise ValueError("unapproved_top_level")
    names = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import) and any(item.name not in {"unittest", "framework"} for item in node.names):
            raise ValueError("unapproved_import")
        if isinstance(node, ast.ImportFrom) and (node.module not in {"unittest", "framework"} or node.level):
            raise ValueError("unapproved_import")
        if isinstance(node, ast.Name) and node.id in forbidden:
            raise ValueError("unapproved_builtin")
        if isinstance(node, ast.Attribute) and node.attr.startswith("__"):
            raise ValueError("unapproved_attribute")
        if isinstance(node, ast.ClassDef):
            if node.decorator_list or len(node.bases) != 1:
                raise ValueError("unapproved_test_class")
            base = node.bases[0]
            if not (isinstance(base, ast.Name) and base.id == "BlackBoxCase" or isinstance(base, ast.Attribute) and isinstance(base.value, ast.Name) and base.value.id == "framework" and base.attr == "BlackBoxCase"):
                raise ValueError("unapproved_test_class")
            if any(not isinstance(child, ast.FunctionDef) for child in node.body):
                raise ValueError("unapproved_class_body")
        if isinstance(node, ast.FunctionDef):
            if not node.name.startswith("test_") or node.decorator_list:
                raise ValueError("unapproved_test_method")
            if not any(isinstance(item, ast.Call) and isinstance(item.func, ast.Attribute) and item.func.attr.startswith("assert") for item in ast.walk(node)):
                raise ValueError("assertion_missing")
            names.append(node.name)
    with open("mapping.json", encoding="utf-8") as stream:
        declared = [item["testName"] for item in json.load(stream)]
    if not names or len(names) != len(set(names)) or set(names) != set(declared):
        raise ValueError("implementation_mapping_invalid")
    return sorted(names)
