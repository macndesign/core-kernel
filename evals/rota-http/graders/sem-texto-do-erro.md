---
type: regex
target: { source: file, path: src/rotas/pedidos.ts }
match: not_contains
---
String\(\s*(result\.)?error\s*\)|message\.(includes|startsWith|endsWith)\(|message\s*===
