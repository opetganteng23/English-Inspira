import { connectDB } from "./db";
import { Question, QuestionGroup, type Section } from "@/models/Question";
import { Test } from "@/models/Test";

// SOAL CONTOH untuk pengembangan. BUKAN soal resmi TOEFL ITP; ganti lewat Bank Soal admin.
type Item = { type: string; stem: string; options: string[]; key: number; why: string };

const structure: Item[] = [
  ["subject-verb", "The results of the experiment ___ surprising.", ["was", "were", "is being", "has been"], 1, "The plural subject 'results' takes 'were'."],
  ["tense", "By the time we arrived, the film ___.", ["already started", "had already started", "has already started", "already starts"], 1, "Past perfect for the earlier action."],
  ["article", "She is ___ honest student.", ["a", "an", "the", "no article"], 1, "'honest' starts with a vowel sound."],
  ["preposition", "He is interested ___ marine biology.", ["on", "at", "in", "for"], 2, "interested in."],
  ["conditional", "If I ___ more time, I would travel the world.", ["have", "had", "would have", "will have"], 1, "Second conditional."],
  ["comparative", "This book is ___ than that one.", ["more interesting", "most interesting", "interestinger", "interesting"], 0, "Comparative for long words."],
  ["gerund", "She avoided ___ the question.", ["to answer", "answering", "answer", "answered"], 1, "avoid + gerund."],
  ["relative-clause", "The man ___ car was stolen called the police.", ["who", "whom", "whose", "which"], 2, "Possession: whose."],
  ["passive", "The bridge ___ in 1998.", ["built", "was built", "is building", "has built"], 1, "Past passive."],
  ["parallelism", "She likes hiking, swimming, and ___.", ["to cycle", "cycling", "cycle", "cycled"], 1, "Parallel -ing form."],
  ["reduced-clause", "___ the report, he left the office.", ["Finished", "Having finished", "To finish", "Finish"], 1, "Perfect participle, the action finished first."],
  ["modal", "You ___ wear a seat belt; it is the law.", ["can", "might", "must", "would"], 2, "A legal obligation."],
  ["word-form", "The scientist gave a very ___ explanation.", ["clearly", "clear", "clarity", "clarify"], 1, "Adjective before a noun."],
  ["quantifier", "There isn't ___ milk left in the fridge.", ["many", "much", "few", "a few"], 1, "Uncountable: much."],
].map(([type, stem, options, key, why]) => ({ type, stem, options, key, why }) as Item);

const reading: { title: string; html: string; items: Item[] }[] = [
  {
    title: "Coral Reefs",
    html: "<p>Coral reefs cover less than one percent of the ocean floor, yet they support about a quarter of all marine species. Reefs protect coastlines from storms and provide food for millions of people. However, rising ocean temperatures cause corals to expel the algae that live in their tissues, a process called bleaching. Without these algae, corals lose their color and their main source of energy.</p>",
    items: [
      ["main-idea", "What is the passage mainly about?", ["Coastal storms", "The importance and threats of coral reefs", "Algae farming", "Marine tourism"], 1, "The text discusses the role of coral reefs and the threats to them."],
      ["detail", "What percentage of the ocean floor do reefs cover?", ["Over 25%", "About 10%", "Less than 1%", "Exactly 5%"], 2, "It says 'less than one percent'."],
      ["detail", "What is bleaching?", ["Corals losing their algae", "Corals growing faster", "Algae eating corals", "Storm damage"], 0, "Corals expel their algae."],
      ["vocab", "The word 'expel' is closest in meaning to:", ["absorb", "push out", "protect", "color"], 1, "expel = push out."],
      ["inference", "What can be inferred about bleached corals?", ["They get more energy", "They are in danger", "They are protected", "They attract fish"], 1, "They lose their main energy source."],
      ["detail", "Reefs benefit people by:", ["Producing oil", "Protecting coasts and giving food", "Making storms", "Cleaning water only"], 1, "Stated in the second sentence."],
      ["reference", "The word 'their' in the last sentence refers to:", ["storms", "people", "corals", "reefs' visitors"], 2, "Refers to corals."],
    ].map(([type, stem, options, key, why]) => ({ type, stem, options, key, why }) as Item),
  },
  {
    title: "The Printing Press",
    html: "<p>Before the fifteenth century, books were copied by hand, which made them rare and expensive. Around 1440, Johannes Gutenberg introduced a printing press using movable metal type. Within fifty years, millions of books had been printed across Europe. Literacy rates rose, and ideas spread faster than ever before, contributing to major scientific and religious changes.</p>",
    items: [
      ["main-idea", "The passage mainly discusses:", ["Hand-copied books", "The effects of the printing press", "Metal mining", "European kings"], 1, "Focus on the impact of the printing press."],
      ["detail", "When did Gutenberg introduce his press?", ["Around 1340", "Around 1440", "Around 1540", "Around 1640"], 1, "Around 1440."],
      ["detail", "Before printing, books were:", ["Cheap", "Copied by hand", "Made of metal", "Banned"], 1, "Copied by hand."],
      ["vocab", "'Movable' is closest in meaning to:", ["fixed", "heavy", "able to be moved", "ancient"], 2, "movable = can be moved."],
      ["inference", "What likely happened to book prices?", ["They fell", "They rose", "Stayed same", "Unknown"], 0, "Mass production lowers prices."],
      ["detail", "What spread faster due to printing?", ["Diseases", "Ideas", "Metals", "Armies"], 1, "'ideas spread faster'."],
      ["detail", "Printing contributed to changes in:", ["Cooking only", "Science and religion", "Sports", "Fashion"], 1, "Scientific and religious change."],
      ["vocab", "The word 'introduced' is closest in meaning to:", ["hid", "brought in", "sold", "forgot"], 1, "introduced = brought in."],
    ].map(([type, stem, options, key, why]) => ({ type, stem, options, key, why }) as Item),
  },
];

// Listening contoh: tanpa audio (unggah MP3 lewat admin). Transkrip ada di stem agar alur tes tetap bisa diuji.
const listening: Item[] = Array.from({ length: 15 }, (_, i) => ({
  type: ["detail", "main-idea", "inference"][i % 3],
  stem: `[Sample Listening ${i + 1}] In the conversation, what will the student do next?`,
  options: ["Go to the library", "Meet the lecturer", "Go home", "Buy a book"],
  key: i % 4,
  why: "Sample question without audio. Replace it with an official Listening question and upload the MP3.",
}));

async function insert(section: Section, items: Item[], groupId?: unknown) {
  return Question.insertMany(
    items.map((it) => ({
      section, type: it.type, stem: it.stem, options: it.options, answerKey: it.key,
      explanation: it.why, tags: [{ skill: section === "structure" ? "grammar" : section, topic: it.type }], groupId, status: "published",
    }))
  );
}

/**
 * Tes contoh untuk pengembangan: placement (42 soal, 15/12/15), simulasi, dan latihan Structure.
 * SOAL CONTOH, bukan soal resmi; ganti lewat Bank Soal. Idempoten.
 */
export async function seedTests() {
  await connectDB();
  if (await Test.exists({ kind: "placement" })) return { skipped: true };

  const listeningQs = await insert("listening", listening);
  const structureQs = await insert("structure", structure.slice(0, 12));
  const readingIds: unknown[] = [];
  for (const p of reading) {
    const g = await QuestionGroup.create({ section: "reading", passageTitle: p.title, passageHtml: p.html, instruction: "Read the passage and answer the questions." });
    readingIds.push(...(await insert("reading", p.items, g._id)).map((q) => q._id));
  }
  const full = [
    { name: "listening", durationSec: 12 * 60, questionIds: listeningQs.map((q) => q._id) },
    { name: "structure", durationSec: 8 * 60, questionIds: structureQs.map((q) => q._id) },
    { name: "reading", durationSec: 17 * 60, questionIds: readingIds },
  ];
  const placement = await Test.create({ name: "Placement Test (sample)", kind: "placement", sections: full });
  await Test.create({ name: "ITP Simulation (sample)", kind: "sim", sections: full });
  await Test.create({ name: "Structure Practice (sample)", kind: "practice", sections: [{ name: "structure", durationSec: 8 * 60, questionIds: structureQs.map((q) => q._id) }] });
  return { placementId: String(placement._id), questions: listeningQs.length + structureQs.length + readingIds.length };
}
