import ast
import json
import sys


def inspect(files):
    errors = []
    for file in files:
        with open(file, encoding="utf-8-sig") as stream:
            tree = ast.parse(stream.read(), filename=file)
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)):
                if node.end_lineno - node.lineno + 1 > 200:
                    errors.append(f"{file}:{node.lineno}: Python function exceeds 200 lines")
    return errors


if __name__ == "__main__":
    print(json.dumps(inspect(sys.argv[1:])))
