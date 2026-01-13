#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const ROOT = path.join(__dirname, "..", "src");
const exts = new Set([".tsx"]);
const ignoreDirs = new Set(["dist", "build", "node_modules", "assets"]);
const ATTRS = new Set(["placeholder", "title", "aria-label", "alt"]);

function walk(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (ignoreDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (exts.has(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

function isIgnorableText(text) {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (/^[\d\s.,:;!?'"()+\-/*=_]+$/.test(trimmed)) return true;
  if (["•", "✕", "✓", "×", "★", "‹", "›", "–"].includes(trimmed)) return true;
  return false;
}

function nodeLine(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const issues = [];

  function visit(node) {
    if (ts.isJsxText(node)) {
      const text = node.getText();
      if (!isIgnorableText(text)) {
        issues.push({ line: nodeLine(sourceFile, node), message: `JSX text literal: "${text.trim()}"` });
      }
    }

    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText();
      if (ATTRS.has(name) && node.initializer && ts.isStringLiteral(node.initializer)) {
        const val = node.initializer.text;
        if (!isIgnorableText(val)) {
          issues.push({ line: nodeLine(sourceFile, node), message: `${name} literal: "${val}"` });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return issues.map((i) => ({ filePath, ...i }));
}

const files = walk(ROOT);
const allIssues = files.flatMap(checkFile);

if (allIssues.length) {
  console.error("i18n check failed: found hardcoded UI strings\n");
  for (const issue of allIssues) {
    console.error(`${issue.filePath}:${issue.line}  ${issue.message}`);
  }
  process.exit(1);
} else {
  console.log("i18n check passed: no hardcoded UI strings found.");
}
