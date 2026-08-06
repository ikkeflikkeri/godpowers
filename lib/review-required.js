/**
 * REVIEW-REQUIRED.mdx manager.
 *
 * Append-only registry of pending reviews. Cleared by /god-review-changes.
 * Populated by:
 *   - god-updater on /god-sync (after impact analysis from forward propagation)
 *   - god-updater on reverse-sync (drift detection findings)
 *   - god-design-reviewer with WARN verdicts (warnings flow here; BLOCKs go
 *     to .godpowers/design/REJECTED.mdx instead)
 *
 * File format: append-only markdown with section per review batch.
 *
 * Public API:
 *   path(projectRoot) -> string
 *   appendBatch(projectRoot, batch) -> void
 *   readEntries(projectRoot) -> [{ batchId, timestamp, source, items }]
 *   clear(projectRoot) -> void
 *   itemCount(projectRoot) -> number
 *   formatBatch(batch) -> markdown
 */

const fs = require('fs');
const path = require('path');

function filePath(projectRoot) {
  return path.join(projectRoot, '.godpowers', 'REVIEW-REQUIRED.mdx');
}

function rejectedPath(projectRoot) {
  return path.join(projectRoot, '.godpowers', 'design', 'REJECTED.mdx');
}

// Pre-mdx runtimes wrote .md twins. Reads resolve to whichever ledger exists
// (canonical .mdx first); appends migrate a legacy twin into the .mdx once
// rather than forking a second ledger.
function legacyPath(file) {
  return file.replace(/\.mdx$/, '.md');
}

function resolveExisting(file) {
  if (fs.existsSync(file)) return file;
  const legacy = legacyPath(file);
  return fs.existsSync(legacy) ? legacy : file;
}

/**
 * Append a review batch to REVIEW-REQUIRED.mdx. A legacy REVIEW-REQUIRED.md
 * is absorbed on the first append: its content seeds the .mdx and the .md is
 * deleted so pending items never fork across two ledgers.
 *
 * batch = {
 *   source: 'design-impact' | 'prd-change' | 'arch-change' | 'reverse-sync-drift' | ...
 *   summary: 'one-line description',
 *   items: [{ id, file, severity: 'error'|'warning'|'info', message, suggestion? }]
 * }
 */
function appendBatch(projectRoot, batch) {
  const file = filePath(projectRoot);
  const source = resolveExisting(file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const ts = new Date().toISOString();
  const id = `${ts.replace(/[:.]/g, '-')}-${batch.source}`;

  const existing = fs.existsSync(source) ? fs.readFileSync(source, 'utf8') : '';
  const header = existing ? '' : `# Review Required

> Pending reviews surfaced by /god-sync, design changes, and drift detection.
> Each batch documents what changed, why it needs review, and what to do.
> Cleared by \`/god-review-changes\` when items are resolved.

`;

  const body = formatBatch({ ...batch, id, timestamp: ts });
  fs.writeFileSync(file, header + existing + body + '\n');
  if (source !== file) fs.unlinkSync(source);
  return { id, path: file, items: batch.items.length };
}

/**
 * Format a batch as markdown.
 */
function formatBatch(batch) {
  const lines = [];
  lines.push(`## Batch: ${batch.id || 'unnamed'}`);
  lines.push('');
  lines.push(`- **Timestamp**: ${batch.timestamp || new Date().toISOString()}`);
  lines.push(`- **Source**: ${batch.source}`);
  lines.push(`- **Summary**: ${batch.summary}`);
  lines.push('');
  if (batch.items && batch.items.length > 0) {
    lines.push('### Items');
    lines.push('');
    for (const item of batch.items) {
      const sev = (item.severity || 'info').toUpperCase();
      const id = item.id ? `[${item.id}]` : '';
      const msg = `[${sev}] ${id} ${item.file ? '`' + item.file + '`' : ''}: ${item.message}`;
      lines.push(`- ${msg.trim()}`);
      if (item.suggestion) {
        lines.push(`  - Suggestion: ${item.suggestion}`);
      }
    }
  } else {
    lines.push('### Items');
    lines.push('');
    lines.push('(none)');
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * Parse the review-required ledger back into structured batches. Best-effort.
 */
function readEntries(projectRoot) {
  const file = resolveExisting(filePath(projectRoot));
  if (!fs.existsSync(file)) return [];
  const content = fs.readFileSync(file, 'utf8');
  const batches = [];
  const lines = content.split('\n');
  let current = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('## Batch:')) {
      if (current) batches.push(current);
      current = {
        batchId: line.replace('## Batch:', '').trim(),
        timestamp: '',
        source: '',
        summary: '',
        items: []
      };
    } else if (current) {
      const tsMatch = line.match(/\*\*Timestamp\*\*:\s*(.+)/);
      if (tsMatch) current.timestamp = tsMatch[1].trim();
      const srcMatch = line.match(/\*\*Source\*\*:\s*(.+)/);
      if (srcMatch) current.source = srcMatch[1].trim();
      const sumMatch = line.match(/\*\*Summary\*\*:\s*(.+)/);
      if (sumMatch) current.summary = sumMatch[1].trim();
      if (line.startsWith('- [')) {
        const m = line.match(/^- \[(\w+)\]\s*(?:\[([^\]]+)\])?\s*(?:`([^`]+)`)?\s*:\s*(.+)$/);
        if (m) {
          current.items.push({
            severity: m[1].toLowerCase(),
            id: m[2] || null,
            file: m[3] || null,
            message: m[4].trim()
          });
        }
      }
    }
  }
  if (current) batches.push(current);
  return batches;
}

/**
 * Remove ONE item from ONE batch, leaving every other byte of the ledger
 * untouched. Text-surgical on purpose: readEntries is a lossy best-effort
 * parser, so a parse-and-rewrite would drop content it cannot round-trip
 * (multi-line suggestions, foreign batch sections). This walks the raw lines,
 * finds the batch whose Source matches and whose Items contain the item id
 * token, and deletes only that item line (plus its indented suggestion
 * lines). A batch left with no items is removed whole; a ledger left with no
 * batches is deleted like clear().
 *
 * Returns { removed: bool, batchRemoved: bool, fileRemoved: bool }.
 */
function removeItem(projectRoot, source, itemId) {
  const file = resolveExisting(filePath(projectRoot));
  if (!fs.existsSync(file)) return { removed: false, batchRemoved: false, fileRemoved: false };
  const lines = fs.readFileSync(file, 'utf8').split('\n');

  // Locate batch section boundaries.
  const batchStarts = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('## Batch:')) batchStarts.push(i);
  }
  let removed = false;
  let batchRemoved = false;
  for (let b = 0; b < batchStarts.length && !removed; b++) {
    const start = batchStarts[b];
    const end = b + 1 < batchStarts.length ? batchStarts[b + 1] : lines.length;
    const section = lines.slice(start, end);
    // Literal match on the parsed Source value; source strings are data, not
    // regex (a source like "sync (auto)" must not become a group).
    const inSource = section.some((line) => {
      const m = line.match(/\*\*Source\*\*:\s*(.+?)\s*$/);
      return m && m[1] === source;
    });
    if (!inSource) continue;
    for (let i = 0; i < section.length; i++) {
      if (!section[i].startsWith('- [') || !section[i].includes(`[${itemId}]`)) continue;
      let cut = 1;
      while (i + cut < section.length && /^\s+- /.test(section[i + cut])) cut += 1;
      section.splice(i, cut);
      removed = true;
      const itemsLeft = section.some((line) => line.startsWith('- ['));
      if (!itemsLeft) {
        lines.splice(start, end - start);
        batchRemoved = true;
      } else {
        lines.splice(start, end - start, ...section);
      }
      break;
    }
  }
  if (!removed) return { removed: false, batchRemoved: false, fileRemoved: false };

  const anyBatchLeft = lines.some((line) => line.startsWith('## Batch:'));
  if (!anyBatchLeft) {
    fs.unlinkSync(file);
    return { removed: true, batchRemoved: true, fileRemoved: true };
  }
  fs.writeFileSync(file, lines.join('\n'));
  return { removed: true, batchRemoved, fileRemoved: false };
}

/**
 * Clear all review-required entries (after they've been addressed).
 */
function clear(projectRoot) {
  const file = filePath(projectRoot);
  const legacy = legacyPath(file);
  let cleared = false;
  for (const candidate of [file, legacy]) {
    if (fs.existsSync(candidate)) {
      fs.unlinkSync(candidate);
      cleared = true;
    }
  }
  return cleared ? { cleared: true } : { cleared: false, reason: 'missing' };
}

/**
 * Count of pending items (across all batches).
 */
function itemCount(projectRoot) {
  return readEntries(projectRoot).reduce((sum, b) => sum + b.items.length, 0);
}

// ============================================================================
// REJECTED.md (design-reviewer BLOCK verdicts)
// ============================================================================

/**
 * Append a rejected design change.
 *
 * rejection = {
 *   verdict: 'BLOCK',
 *   stage1: 'misaligned' | 'needs-discussion',
 *   stage2: 'errors' | 'warnings' | 'passes',
 *   diffSummary: 'short summary',
 *   findings: [{ severity, code, message }],
 *   resolutionRequired: 'what to fix before resubmitting'
 * }
 */
function appendRejection(projectRoot, rejection) {
  const file = rejectedPath(projectRoot);
  const source = resolveExisting(file);
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString();

  const header = fs.existsSync(source) ? '' : `# Design Changes Rejected

> Append-only audit trail of DESIGN.md / PRODUCT.md changes that
> god-design-reviewer blocked. Each entry documents what was attempted,
> why it was rejected, and what must change before resubmission.

`;

  const lines = [];
  lines.push(`## Rejected: ${ts}`);
  lines.push('');
  lines.push(`### Verdict`);
  lines.push(`${rejection.verdict || 'BLOCK'}`);
  lines.push('');
  lines.push(`### Stages`);
  lines.push(`- Stage 1 (spec): ${rejection.stage1 || 'unknown'}`);
  lines.push(`- Stage 2 (quality): ${rejection.stage2 || 'unknown'}`);
  lines.push('');
  lines.push(`### Diff scope`);
  lines.push(rejection.diffSummary || '(no summary)');
  lines.push('');
  if (rejection.findings && rejection.findings.length > 0) {
    lines.push(`### Findings`);
    for (const f of rejection.findings) {
      lines.push(`- [${(f.severity || 'error').toUpperCase()}] ${f.code || ''} ${f.message}`);
    }
    lines.push('');
  }
  if (rejection.resolutionRequired) {
    lines.push(`### Resolution required`);
    lines.push(rejection.resolutionRequired);
    lines.push('');
  }

  const existing = fs.existsSync(source) ? fs.readFileSync(source, 'utf8') : '';
  fs.writeFileSync(file, header + existing + lines.join('\n') + '\n');
  if (source !== file) fs.unlinkSync(source);
  return { path: file, timestamp: ts };
}

module.exports = {
  path: filePath,
  rejectedPath,
  appendBatch,
  formatBatch,
  readEntries,
  removeItem,
  clear,
  itemCount,
  appendRejection
};
