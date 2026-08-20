export type InternetTopicSeed = {
  title: string;
  difficulty: number;
};

export const internetTopicConstraints = [
  "Retrace son évolution avec une chronologie de cinq étapes maximum.",
  "Explique le sujet à travers un exemple précis devenu emblématique de la culture Internet.",
  "Compare son fonctionnement à ses débuts avec sa forme actuelle.",
  "Consacre une slide à ses codes, son vocabulaire et ses pratiques communautaires.",
  "Présente un bénéfice, un risque et une controverse associés au sujet.",
  "Montre comment les plateformes, les algorithmes ou les outils techniques ont influencé son développement.",
  "Analyse un contenu représentatif sans afficher d’information personnelle ni de contenu choquant.",
  "Distingue ce qui relève de la culture populaire, de la technique et du modèle économique.",
  "Compare la perception médiatique du phénomène avec les pratiques réelles de ses communautés.",
  "Présente une règle, une norme ou un usage informel qui structure ce phénomène en ligne.",
  "Relie le sujet à une question de modération, d’archivage, de droit d’auteur ou de vie privée.",
  "Termine par une prédiction argumentée sur son évolution dans les cinq prochaines années.",
] as const;

export const getInternetTopicConstraint = (index: number) =>
  internetTopicConstraints[index % internetTopicConstraints.length];

export const internetTopics: InternetTopicSeed[] = [
  { title: "ARG", difficulty: 2 },
  { title: "Reddit", difficulty: 1 },
  { title: "4chan", difficulty: 2 },
  { title: "Memes", difficulty: 1 },
  { title: "Creepypasta", difficulty: 2 },
  { title: "Lost Media", difficulty: 2 },
  { title: "Anonymous", difficulty: 2 },
  { title: "Fandoms", difficulty: 2 },
  { title: "Forums", difficulty: 3 },
  { title: "Speedrun", difficulty: 2 },
  { title: "Web 1.0", difficulty: 2 },
  { title: "Web 2.0", difficulty: 1 },
  { title: "Web3", difficulty: 2 },
];
