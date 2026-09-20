'use client';

/**
 * StreamedMarkdown — block-memoized markdown renderer.
 *
 * ReactMarkdown re-parses the whole string on every render, which at a few
 * thousand tokens makes a streaming answer visibly janky. Instead we split the
 * text on blank lines (respecting fenced code blocks and tables so they are
 * never cut in half), render every "closed" block through a memoised
 * component, and only re-parse the last, still-growing block.
 *
 * Completed messages use the same component so a long history stays cheap
 * to re-render when unrelated state (a hover card, quick replies) changes.
 */

import { memo, useMemo } from 'react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

const preserveDocUrl = (url: string): string =>
  url.startsWith('doc:') ? url : defaultUrlTransform(url);

const LIST_ITEM_RE = /^\s{0,3}(?:[-*+]|\d+[.)])\s/;
const LINK_DEF_RE = /^\s{0,3}\[[^\]]+\]:\s/;
const FENCE_RE = /^\s{0,3}(```+|~~~+)/;

/**
 * Split markdown into independently renderable chunks without breaking
 * constructs that span blank lines:
 *  - fenced code blocks
 *  - "loose" lists (items separated by blank lines — splitting them would
 *    restart numbering at 1 for every item)
 *  - indented continuation paragraphs inside a list item (a standalone
 *    4-space-indented line would render as a code block)
 *  - reference link definitions, which stay attached to the text above them
 */
export function splitMarkdownBlocks(text: string): string[] {
  const lines = text.split('\n');
  const blocks: string[] = [];
  let current: string[] = [];
  let inFence = false;
  let fenceMarker = '';

  const flush = () => {
    if (current.length) {
      blocks.push(current.join('\n'));
      current = [];
    }
  };

  const nextNonBlank = (from: number): string | undefined => {
    for (let j = from; j < lines.length; j++) {
      if (lines[j].trim() !== '') return lines[j];
    }
    return undefined;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = FENCE_RE.exec(line);
    if (fence) {
      if (!inFence) {
        inFence = true;
        fenceMarker = fence[1][0];
      } else if (line.trim().startsWith(fenceMarker)) {
        inFence = false;
      }
      current.push(line);
      continue;
    }
    if (inFence) {
      current.push(line);
      continue;
    }
    if (line.trim() === '') {
      const next = nextNonBlank(i + 1);
      // "In a list" means the block currently *ends* in list context — an
      // intro line ("Here are the steps:") directly above the first item is
      // part of the same block and must not break the numbering.
      const lastLine = current.length > 0 ? current[current.length - 1] : '';
      const currentIsList =
        current.length > 0 && (LIST_ITEM_RE.test(lastLine) || /^\s{2,}\S/.test(lastLine));
      const keepTogether =
        next !== undefined &&
        (/^\s{2,}\S/.test(next) || // indented continuation / nested item
          (currentIsList && LIST_ITEM_RE.test(next)) || // loose list
          LINK_DEF_RE.test(next)); // reference definition
      if (keepTogether && current.length > 0) {
        current.push(line);
      } else {
        flush();
      }
      continue;
    }
    current.push(line);
  }
  flush();
  return blocks;
}

interface BlockProps {
  text: string;
  components?: Components;
}

const MarkdownBlock = memo(function MarkdownBlock({ text, components }: BlockProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      urlTransform={preserveDocUrl}
      components={components}
    >
      {text}
    </ReactMarkdown>
  );
});

interface StreamedMarkdownProps {
  content: string;
  components?: Components;
}

export function StreamedMarkdown({ content, components }: StreamedMarkdownProps) {
  const blocks = useMemo(() => splitMarkdownBlocks(content), [content]);
  return (
    <>
      {blocks.map((block, i) => (
        // Index keys are correct here: closed blocks never change position, and
        // the tail block re-renders in place as it grows.
        <MarkdownBlock key={i} text={block} components={components} />
      ))}
    </>
  );
}
