// XML for SOAP steps: a small parser for request checks and response values.
// No k6 or DOM imports: the backend checks bodies with it and k6 reads responses with it.

export interface XmlElement {
  /** Name without its namespace prefix: soap:Body is Body. */
  name: string;
  children: XmlElement[];
  /** Text directly inside the element, entities decoded and CDATA as written. */
  text: string;
}

// An open tag with its attributes; sticky, so it matches only where the tag starts.
const OPEN_TAG =
  /<([\p{L}_][\p{L}\p{N}.:_-]*)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"<]*"|'[^'<]*'))*)\s*(\/?)>/uy;
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
export function parseXml(text: string): XmlElement {
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

/** Escapes a value for XML text or a quoted attribute value. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** The outermost elements named `name` inside `element`: a match's own children are not searched. */
function descendantsNamed(element: XmlElement, name: string): XmlElement[] {
  return element.children.flatMap((child) =>
    child.name === name ? [child] : descendantsNamed(child, name),
  );
}

/**
 * The trimmed text of the element at `path`, or undefined when there is none or it is empty.
 * Each name finds the outermost elements with that name at any depth inside the matches so far
 * (namespace prefixes ignored), and a number picks one of the matches: Token,
 * LoginResponse.Token or Item.1.Id. The value is the first match's text.
 */
export function xmlValue(document: XmlElement, path: string): string | undefined {
  let matches = [document];
  for (const segment of path.split('.')) {
    if (/^\d+$/.test(segment)) {
      matches = matches.slice(Number(segment), Number(segment) + 1);
      continue;
    }
    const name = localName(segment);
    matches = matches.flatMap((match) => descendantsNamed(match, name));
  }
  // An empty element, or one with only child elements, has no value to save.
  const value = matches[0] === document ? undefined : matches[0]?.text.trim();
  return value === '' ? undefined : value;
}

/** Element names only, no text or attributes; repeated siblings show once: <Envelope><Body/>... */
export function xmlShape(element: XmlElement): string {
  const seen = new Set<string>();
  const unique = element.children.filter((child) => !seen.has(child.name) && seen.add(child.name));
  const inner = unique.map(xmlShape).join('');
  if (element.name === '') return inner;
  return inner === '' ? `<${element.name}/>` : `<${element.name}>${inner}</${element.name}>`;
}
