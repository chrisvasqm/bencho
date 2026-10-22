// XML checks for SOAP bodies: the same parser as the backend (k6/lib/xml.ts), so the form
// accepts exactly what the backend accepts. DOMParser differs, for example on namespaces.

interface XmlElement {
  /** Name without its namespace prefix: soap:Body is Body. */
  name: string;
  children: XmlElement[];
  /** Text directly inside the element, entities decoded and CDATA as written. */
  text: string;
}

// XML name characters (BMP) as ranges: k6's regex engine fails on \p{L} at index 0. Joiners
// and combining marks are left out (lint: misleading character class); names rarely use them.
const NAME_START =
  'A-Za-z_\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF' +
  '\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD';
const NAME_REST = `${NAME_START}0-9.:\\u00B7\\u203F\\u2040-`;
// An open tag with its attributes; sticky, so it matches only where the tag starts.
const OPEN_TAG = new RegExp(
  `<([${NAME_START}][${NAME_REST}]*)((?:\\s+[^\\s=/>]+\\s*=\\s*(?:"[^"<]*"|'[^'<]*'))*)\\s*(/?)>`,
  'y',
);
// Only the five predefined entities and character references: no DOCTYPE, so no others exist.
const BAD_AMPERSAND = /&(?!(?:#x[0-9A-Fa-f]+|#\d+|lt|gt|amp|quot|apos);)/;
const ENTITY = /&(#x[0-9A-Fa-f]+|#\d+|lt|gt|amp|quot|apos);/g;
const NAMED_ENTITIES: Record<string, string> = {
  lt: '<',
  gt: '>',
  amp: '&',
  quot: '"',
  apos: "'",
};

function localName(name: string): string {
  return name.slice(name.indexOf(':') + 1);
}

function decodeText(text: string): string {
  if (BAD_AMPERSAND.test(text)) throw new Error('An & must start an entity such as &amp;');
  return text.replace(ENTITY, (match, entity: string) => {
    if (!entity.startsWith('#')) return NAMED_ENTITIES[entity] ?? match;
    const code = entity.startsWith('#x') ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    // Only characters XML allows: tab, line breaks and everything from space up.
    const allowed =
      code === 0x9 || code === 0xa || code === 0xd || (code >= 0x20 && code <= 0x10ffff);
    if (!allowed) throw new Error(`&${entity}; is not an XML character`);
    return String.fromCodePoint(code);
  });
}

/** Index just past `close`, searched from `from`; throws when the document never closes it. */
function skipPast(text: string, from: number, close: string): number {
  const end = text.indexOf(close, from);
  if (end === -1) throw new Error(`Missing ${close}`);
  return end + close.length;
}

/**
 * Parses a well-formed XML document: one root element, every tag closed, no text outside the
 * root. Comments and processing instructions are skipped; a DOCTYPE is refused. Throws if not.
 */
function parseXml(text: string): XmlElement {
  // A document node above the root, so the root is found like any other element.
  const document: XmlElement = { name: '', children: [], text: '' };
  const open: { tag: string; element: XmlElement }[] = [];
  // A UTF-8 byte order mark, as .NET services send, is not text outside the root.
  let index = text.startsWith('\uFEFF') ? 1 : 0;
  while (index < text.length) {
    const parent = open[open.length - 1]?.element;
    if (text.charAt(index) !== '<') {
      const next = text.indexOf('<', index);
      const end = next === -1 ? text.length : next;
      const chunk = text.slice(index, end);
      if (!parent && chunk.trim() !== '') throw new Error('Text outside the root element');
      if (parent) parent.text += decodeText(chunk);
      index = end;
    } else if (text.startsWith('<!--', index)) {
      index = skipPast(text, index + 4, '-->');
    } else if (text.startsWith('<![CDATA[', index)) {
      if (!parent) throw new Error('CDATA outside the root element');
      const end = skipPast(text, index + 9, ']]>');
      parent.text += text.slice(index + 9, end - 3);
      index = end;
    } else if (text.startsWith('<?', index)) {
      index = skipPast(text, index + 2, '?>');
    } else if (text.startsWith('<!', index)) {
      throw new Error('DOCTYPE is not supported');
    } else if (text.startsWith('</', index)) {
      const end = skipPast(text, index + 2, '>');
      const tag = text.slice(index + 2, end - 1).trim();
      if (open.pop()?.tag !== tag) throw new Error(`Unexpected </${tag}>`);
      index = end;
    } else {
      OPEN_TAG.lastIndex = index;
      const match = OPEN_TAG.exec(text);
      if (!match) throw new Error('Invalid tag');
      const [whole, tag = '', attributes = '', selfClosing] = match;
      decodeText(attributes);
      if (!parent && document.children.length > 0) throw new Error('More than one root element');
      const element: XmlElement = { name: localName(tag), children: [], text: '' };
      (parent ?? document).children.push(element);
      if (!selfClosing) open.push({ tag, element });
      index += whole.length;
    }
  }
  const root = document.children[0];
  if (open.length > 0 || !root) throw new Error('The document is not complete');
  return document;
}

export function isWellFormedXml(text: string): boolean {
  try {
    parseXml(text);
    return true;
  } catch {
    return false;
  }
}
