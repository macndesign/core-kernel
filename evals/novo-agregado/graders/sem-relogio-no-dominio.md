---
type: regex
target: { source: file, path: src/emprestimo.entity.ts }
match: not_contains
---
new Date\(\)|Date\.now\(\)
