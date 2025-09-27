#!/usr/bin/env python3
"""
parse_tree.py

Read MUI SimpleTreeView HTML from a file or stdin and convert it into a JSON structure.

Usage:
    python scripts/parse_tree.py path/to/file.html
    cat file.html | python scripts/parse_tree.py

This script uses BeautifulSoup (bs4). Install with:
    pip install beautifulsoup4

By default the script emits a JSON array of node objects:
    [ { "key": ..., "value": ..., "children": [...] }, ... ]

New: pass `--object` to output a nested JSON object where each node's
`key` becomes an object property and leaf nodes become values. Example:
    {
        "breakpoints": {
            "keys": { "0": "xs", "1": "sm", ... },
            "values": { ... }
        }
    }

The parser will also attempt simple value coercion for leaf token text
(integers, floats, booleans) and will strip surrounding quotes from string
tokens.
"""
import sys
import json
import argparse
from bs4 import BeautifulSoup


def extract_label(li):
    label_el = li.select_one('.MuiTreeItem-label')
    if not label_el:
        text = li.get_text(' ', strip=True)
        return text, None

    # If there is a token span (e.g. <span class="token string">"px"</span>)
    # prefer that as the value. Otherwise compute the label text by joining
    # text nodes while excluding span.token contents.
    token = label_el.select_one('span.token')
    token_text = token.get_text(' ', strip=True) if token else None

    # Build label text by concatenating direct text nodes and child tags
    parts = []
    for child in label_el.children:
        # Skip token spans entirely
        if getattr(child, 'name', None) == 'span' and 'token' in (child.get('class') or []):
            continue
        # For tags, get their full text; for NavigableString, use str()
        try:
            txt = child.get_text(' ', strip=True)
        except Exception:
            txt = str(child).strip()
        if txt:
            parts.append(txt)

    key_text = ' '.join(parts).strip()
    if key_text == '':
        key_text = label_el.get_text(' ', strip=True)
    return key_text, token_text


def parse_li(li):
    raw, token_value = extract_label(li)
    key = raw
    value = token_value
    # If no token_value, fall back to colon-split value (e.g. "unit: "px"")
    if value is None and ':' in raw:
        parts = raw.split(':', 1)
        key = parts[0].strip()
        v = parts[1].strip()
        value = v or None

    # Try to coerce simple values
    if isinstance(value, str):
        v = value
        # strip surrounding quotes
        if len(v) >= 2 and ((v[0] == '"' and v[-1] == '"') or (v[0] == "'" and v[-1] == "'")):
            v = v[1:-1]
        # booleans
        if v.lower() == 'true':
            value = True
        elif v.lower() == 'false':
            value = False
        else:
            # numbers
            try:
                if '.' in v:
                    value = float(v)
                else:
                    value = int(v)
            except Exception:
                value = v

    node = {'key': key, 'value': value, 'children': []}

    # find the first descendant <ul> that groups this item's children
    child_ul = li.find('ul')

    if child_ul:
        # Find descendant <li> elements that are direct children of this group.
        # The HTML often wraps the actual <li> items inside several <div> wrappers
        # (e.g. .MuiCollapse-wrapperInner). We want li elements that do NOT have
        # another <li> between them and the child_ul in the DOM chain.
        for candidate in child_ul.find_all('li'):
            # walk up from candidate to child_ul and stop if we find an intervening li
            p = candidate.parent
            intervening_li = False
            while p is not None and p != child_ul:
                if p.name == 'li':
                    intervening_li = True
                    break
                p = p.parent
            if not intervening_li:
                node['children'].append(parse_li(candidate))

    return node


def parse(html):
    soup = BeautifulSoup(html, 'html.parser')
    root = soup.select_one('ul[role="tree"]')
    if not root:
        raise SystemExit('No <ul role="tree"> found')

    nodes = []
    # top-level li elements that represent tree items
    for li in root.find_all('li', recursive=False):
        if 'MuiTreeItem-root' in (li.get('class') or []):
            nodes.append(parse_li(li))
    return nodes


def tree_to_object(nodes):
    obj = {}
    for n in nodes:
        key = n['key']
        if not n['children']:
            obj[key] = n['value']
        else:
            obj[key] = tree_to_object(n['children'])
    return obj


def main():
    parser = argparse.ArgumentParser(
        description='Parse MUI TreeView HTML into JSON')
    parser.add_argument('input', nargs='?',
                        help='HTML input file (defaults to stdin)')
    parser.add_argument(
        '-o', '--output', help='Write JSON output to file (defaults to stdout)')
    parser.add_argument('--object', action='store_true',
                        help='Output nested JSON object instead of node array')
    args = parser.parse_args()

    if args.input:
        with open(args.input, 'r', encoding='utf-8') as f:
            html = f.read()
    else:
        html = sys.stdin.read()

    tree = parse(html)
    if args.output and args.output.endswith('.json') and getattr(args, 'object', False):
        out_obj = tree_to_object(tree)
        out = json.dumps(out_obj, indent=2, ensure_ascii=False)
    elif getattr(args, 'object', False):
        out_obj = tree_to_object(tree)
        out = json.dumps(out_obj, indent=2, ensure_ascii=False)
    else:
        out = json.dumps(tree, indent=2, ensure_ascii=False)

    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(out + "\n")
    else:
        print(out)


if __name__ == '__main__':
    main()
