export type InternetFigureSeed = {
  title: string;
  difficulty: number;
};

export const internetFigureConstraints = [
  "Explique son apport à Internet avec un schéma compréhensible par une personne non technique.",
  "Présente une innovation associée à cette personne et distingue clairement invention, amélioration et popularisation.",
  "Construis une chronologie de cinq dates maximum reliant son parcours à l’évolution d’Internet.",
  "Consacre une slide aux effets positifs de son action et une autre à ses limites ou controverses.",
  "Explique un protocole, un logiciel ou une plateforme lié à cette personne sans employer plus de trois termes techniques.",
  "Compare sa vision d’Internet avec celle d’une autre personnalité du numérique.",
  "Intègre une source primaire : code, manifeste, interview, billet, document technique ou déclaration publique.",
  "Montre comment son travail influence encore une pratique numérique actuelle.",
  "Présente les enjeux de liberté, de vie privée, de propriété ou de gouvernance soulevés par son parcours.",
  "Distingue les faits établis, les récits médiatiques et les zones encore incertaines autour de cette personne.",
  "Cartographie les communautés, institutions ou entreprises ayant permis à son projet de se développer.",
  "Termine par une question ouverte sur l’avenir d’Internet directement liée à son héritage.",
] as const;

export const getInternetFigureConstraint = (index: number) =>
  internetFigureConstraints[index % internetFigureConstraints.length];

export const internetFigures: InternetFigureSeed[] = [
  { title: "Aaron Swartz", difficulty: 2 },
  { title: "Tim Berners-Lee", difficulty: 1 },
  { title: "Satoshi Nakamoto", difficulty: 2 },
  { title: "Vint Cerf", difficulty: 3 },
  { title: "Robert Kahn", difficulty: 3 },
  { title: "Linus Torvalds", difficulty: 2 },
  { title: "Jimmy Wales", difficulty: 1 },
  { title: "Julian Assange", difficulty: 2 },
  { title: "Edward Snowden", difficulty: 1 },
  { title: "Bram Cohen", difficulty: 3 },
];
