// Penjelasan tiap kelompok kemampuan (TOEFL ITP) untuk peserta. Kunci = Level.key.
export const LEVEL_INFO: Record<string, { summary: string; traits: string }> = {
  basic: {
    summary: "Your English is at a basic level.",
    traits: "You understand common everyday words and short, simple sentences, but fast conversations and long reading passages are still hard.",
  },
  intermediate: {
    summary: "Your English is at an intermediate level.",
    traits: "You handle fairly complex grammar, catch the main idea of academic conversations, and understand popular articles. Scores of 500 to 550 often meet graduation, job, or civil service requirements.",
  },
  advanced: {
    summary: "Your English is at an advanced level.",
    traits: "You master complex structures, follow fast or long academic conversations, and analyse scientific texts with advanced vocabulary.",
  },
};
