// Nama tampilan topik soal (tag di bank soal). Topik yang belum dipetakan ditampilkan dari slug-nya.
export const TOPIC: Record<string, string> = {
  "infinitive-gerund": "Gerund & infinitive", inversion: "Inversion", "reduced-clause": "Reduced clause", cleft: "Cleft sentence", "verb-form": "Verb form & tenses",
  "adj-clause": "Adjective clause", parallelism: "Parallel structure", "plural-noun": "Singular & plural noun", "noun-adverb-clause": "Noun & adverb clause",
  "sv-agreement": "Subject–verb agreement", redundancy: "Redundancy", "paired-conj": "Paired conjunction", pronoun: "Pronoun", "subject-verb": "Subject & verb",
  "word-form": "Word form", comparison: "Comparison", article: "Article", conjunction: "Conjunction", preposition: "Preposition", tense: "Tenses", tenses: "Tenses",
  "main-idea": "Main idea", detail: "Detail", "phrasal-verb": "Phrasal verb", reason: "Reason", agreement: "Agreement & disagreement", implication: "Implication",
  purpose: "Purpose", idiom: "Idiom", inference: "Inference", suggestion: "Suggestion", conditional: "Conditional", restatement: "Restatement", negative: "Negative expression",
  "negative-fact": "Negative fact (NOT/EXCEPT)", reference: "Reference", vocabulary: "Vocabulary", attitude: "Author’s attitude",
};
export const SKILL: Record<string, string> = { grammar: "Structure", structure: "Structure", listening: "Listening", reading: "Reading" };
export const topicName = (t: string) => TOPIC[t] ?? t.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
