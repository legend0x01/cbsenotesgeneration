/* =========================================================================
 * PROMPTS — shared by the browser (window.NcertPrompts) and the
 * /api/generate server function (require('../js/prompts.js')), so every
 * AI writes notes with exactly the same instructions.
 * ========================================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NcertPrompts = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SYSTEM = `You are an expert CBSE teacher and NCERT subject specialist who writes outstanding, accurate study notes for Indian school students.
Follow the latest rationalised NCERT textbook closely: its order, terminology, definitions, laws, examples, activities, boxes and in-text questions.
Accuracy is critical. Never invent facts, data, dates or formulas. If something is not in NCERT, keep it brief and clearly mark it as extra.
Write in clear, simple English that a student of that class can follow, but go deep: explain the why and the how, not just the what.
Formatting rules (Markdown):
- Use LaTeX for every formula and equation: $...$ inline and $$...$$ on its own line. Use \\ce{...} for chemical formulas and equations.
- Use tables for comparisons, differences and classifications.
- Use "> **Exam Tip:**", "> **Remember:**" and "> **Common Mistake:**" callouts where useful.
- Describe important diagrams in words, naming every labelled part.
- No preamble such as "Sure" or "Here are the notes".`;

  const chapterLabel = ch => (ch.isPoem ? 'Poem ' : 'Chapter ') + ch.number;
  const chapterRef = ch => `NCERT Class ${ch.class} ${ch.subject}, book "${ch.book}", ${chapterLabel(ch)}: "${ch.title}"`;
  const isLiterature = ch => ch.subject === 'English';

  function outlinePrompt(ch) {
    const lit = isLiterature(ch);
    return `Create a complete topic map for ${chapterRef(ch)}.
Split the WHOLE ${ch.isPoem ? 'poem' : 'chapter'} into ${lit ? (ch.isPoem ? '3 to 5' : '4 to 6') : '6 to 10'} sequential study parts, in the textbook's order, so that together they cover ${lit
      ? 'everything a student needs: about the author/poet and background, a detailed summary, a section-by-section (or stanza-by-stanza) explanation with difficult words, characters, themes, message, literary devices, and all textbook questions with answers'
      : 'every section, sub-section, concept, definition, law, formula, derivation, solved example, activity and box item in the chapter'}.
Each part must group closely related topics that can be explained in depth in about 1200 to 1800 words.
The final part must be titled "Chapter Summary, Key Points & Exam Practice".
For each part give a short title and the list of topics it covers (use the textbook's section names where possible).`;
  }

  // Gemini enforces this schema; other models get OUTLINE_JSON_HINT appended instead.
  const OUTLINE_SCHEMA = {
    type: 'OBJECT',
    properties: {
      chunks: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: { title: { type: 'STRING' }, topics: { type: 'ARRAY', items: { type: 'STRING' } } },
          required: ['title', 'topics']
        }
      }
    },
    required: ['chunks']
  };
  const OUTLINE_JSON_HINT = '\n\nReply with ONLY a JSON object exactly like {"chunks":[{"title":"...","topics":["...","..."]}]} and nothing else.';

  function chunkPrompt(ch, outline, i) {
    const map = outline.map((c, k) => `${k + 1}. ${c.title}: ${c.topics.join('; ')}`).join('\n');
    const part = outline[i];
    const last = i === outline.length - 1;
    const lit = isLiterature(ch);
    return `Chapter: ${chapterRef(ch)}

Full topic map of the chapter:
${map}

${i > 0 ? `Parts 1 to ${i} have already been written. Do not repeat them; you may refer back briefly.\n` : ''}Now write PART ${i + 1} of ${outline.length}: "${part.title}".
Cover exactly these topics, in this order: ${part.topics.join('; ')}.

Requirements:
- Begin with the heading "## Part ${i + 1}: ${part.title}".
- Use a "###" heading for each topic.
${last ? `- Give a complete chapter summary, all key terms/definitions${lit ? '' : ' and every formula'} in one place, then exam practice: MCQs, short-answer, long-answer${lit ? ' and extract-based' : ''} questions in CBSE board pattern, each with a model answer.`
      : lit ? `- Explain in great detail with quotes from the text, meanings of difficult words, interpretation, characters, themes and literary devices as relevant.
- Answer any textbook questions related to this part.`
      : `- Explain every concept from the basics in great detail: what it is, why it happens, how it works. Put NCERT definitions in **bold**.
- Give every relevant formula with each symbol and its SI unit explained, and step-by-step derivations where NCERT has them.
- Include fully worked examples (NCERT examples and similar exam questions) for any numerical or problem-solving topic.
- Add real-life examples, comparison tables and exam tips where they help.`}
- End with "### Quick Revision" (bullet points) ${last ? '' : 'and "### Check Your Understanding" (3 to 5 questions with short answers)'}.`;
  }

  /* Clean an outline from any model (or from a client) into [{ title, topics[] }], or null. */
  function normalizeOutline(raw) {
    const list = Array.isArray(raw) ? raw : raw && Array.isArray(raw.chunks) ? raw.chunks : null;
    if (!list) return null;
    const outline = list
      .filter(c => c && typeof c.title === 'string' && c.title.trim())
      .slice(0, 15)
      .map(c => ({
        title: c.title.trim().slice(0, 200),
        topics: (Array.isArray(c.topics) ? c.topics : []).map(t => String(t).trim().slice(0, 200)).filter(Boolean).slice(0, 30)
      }));
    return outline.length >= 2 ? outline : null;
  }

  /* Pull the JSON object out of a model reply that may contain code fences or extra words. */
  function parseOutlineText(text) {
    const s = String(text || '').replace(/```(?:json)?/gi, '');
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b <= a) return null;
    try { return normalizeOutline(JSON.parse(s.slice(a, b + 1))); } catch { return null; }
  }

  return { SYSTEM, chapterLabel, outlinePrompt, chunkPrompt, OUTLINE_SCHEMA, OUTLINE_JSON_HINT, normalizeOutline, parseOutlineText };
});
