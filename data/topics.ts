import { artists, getArtistConstraint } from "./artists";
import { artMovements, getArtMovementConstraint } from "./art-movements";
import { getPhilosophyConstraint, philosophyMovements } from "./philosophy-movements";
import { getSocialScienceConstraint, socialScienceTheories } from "./social-science-theories";
import { getPoliticalConstraint, politicalMovements } from "./political-movements";
import { getPoliticalFigureConstraint, politicalFigures } from "./political-figures";
import { getScientistConstraint, scientists } from "./scientists";
import { getInternetFigureConstraint, internetFigures } from "./internet-figures";
import { getInternetTopicConstraint, internetTopics } from "./internet-topics";
import { getHistoricalPeriodConstraint, historicalPeriods } from "./historical-periods";
import { getReligiousMovementConstraint, religiousMovements } from "./religious-movements";
import { getSocialScienceThinkerConstraint, socialScienceThinkers } from "./social-science-thinkers";
import { getPhilosopherConstraint, philosophers } from "./philosophers";
import { countries, getCountryConstraint } from "./countries";
import { getWaterGeographyConstraint, waterGeographyTopics } from "./water-geography";

export type Topic = {
  category: string;
  title: string;
  difficulty: number;
  constraint: string;
  accent: string;
  region?: string;
};

const literatureConstraints = [
  "Présente une œuvre incontournable et explique pourquoi elle compte.",
  "Replace l’autrice dans son époque avec une chronologie de cinq dates maximum.",
  "Intègre une citation courte et correctement attribuée.",
  "Compare deux œuvres ou deux périodes de sa carrière.",
  "Explique son style à quelqu’un qui ne l’a jamais lue.",
  "Consacre une slide à la réception critique de son œuvre.",
  "Présente un thème récurrent sans révéler la fin d’une œuvre.",
  "Ajoute une carte des lieux importants de sa vie ou de son œuvre.",
];

const womenWriters: Array<[string, number]> = [
  ["Jane Austen", 2],
  ["Virginia Woolf", 3],
  ["Mary Shelley", 2],
  ["George Sand", 2],
  ["Colette", 2],
  ["Simone de Beauvoir", 3],
  ["Marguerite Duras", 3],
  ["Annie Ernaux", 2],
  ["Marguerite Yourcenar", 3],
  ["Françoise Sagan", 1],
  ["Madame de Lafayette", 3],
  ["Madame de Staël", 4],
  ["Christine de Pizan", 4],
  ["Louise Labé", 3],
  ["Olympe de Gouges", 2],
  ["Marceline Desbordes-Valmore", 3],
  ["Nathalie Sarraute", 4],
  ["Violette Leduc", 3],
  ["Assia Djebar", 3],
  ["Leïla Slimani", 1],
  ["Marie NDiaye", 3],
  ["Delphine de Vigan", 1],
  ["Amélie Nothomb", 1],
  ["Virginie Despentes", 2],
  ["Maylis de Kerangal", 2],
  ["George Eliot", 3],
  ["Charlotte Brontë", 2],
  ["Emily Brontë", 2],
  ["Anne Brontë", 3],
  ["Elizabeth Gaskell", 3],
  ["Mary Wollstonecraft", 3],
  ["Agatha Christie", 1],
  ["Doris Lessing", 3],
  ["Iris Murdoch", 4],
  ["Jeanette Winterson", 3],
  ["Zadie Smith", 2],
  ["Angela Carter", 3],
  ["Daphne du Maurier", 2],
  ["Katherine Mansfield", 3],
  ["Hilary Mantel", 2],
  ["Sylvia Plath", 2],
  ["Emily Dickinson", 3],
  ["Edith Wharton", 3],
  ["Willa Cather", 3],
  ["Flannery O’Connor", 3],
  ["Harper Lee", 1],
  ["Carson McCullers", 3],
  ["Shirley Jackson", 2],
  ["Ursula K. Le Guin", 2],
  ["Octavia E. Butler", 2],
  ["Toni Morrison", 2],
  ["Alice Walker", 2],
  ["Maya Angelou", 2],
  ["bell hooks", 3],
  ["Joan Didion", 3],
  ["Susan Sontag", 4],
  ["Joyce Carol Oates", 3],
  ["Donna Tartt", 1],
  ["Margaret Atwood", 2],
  ["Alice Munro", 3],
  ["Anne Carson", 5],
  ["Louise Erdrich", 3],
  ["Chimamanda Ngozi Adichie", 1],
  ["Nnedi Okorafor", 3],
  ["Buchi Emecheta", 3],
  ["Tsitsi Dangarembga", 3],
  ["Nadine Gordimer", 3],
  ["Nawal El Saadawi", 3],
  ["Hoda Barakat", 4],
  ["Hanan al-Shaykh", 3],
  ["Han Kang", 2],
  ["Yōko Ogawa", 2],
  ["Banana Yoshimoto", 1],
  ["Sayaka Murata", 1],
  ["Mieko Kawakami", 2],
  ["Hiromi Kawakami", 2],
  ["Yūko Tsushima", 3],
  ["Can Xue", 5],
  ["Eileen Chang", 3],
  ["Sanmao", 4],
  ["Clarice Lispector", 4],
  ["Isabel Allende", 2],
  ["Laura Esquivel", 2],
  ["Samanta Schweblin", 3],
  ["Mariana Enriquez", 2],
  ["Silvina Ocampo", 4],
  ["Alejandra Pizarnik", 4],
  ["Gabriela Mistral", 3],
  ["Sor Juana Inés de la Cruz", 4],
  ["Rosario Castellanos", 3],
  ["Elena Ferrante", 1],
  ["Grazia Deledda", 4],
  ["Natalia Ginzburg", 3],
  ["Elsa Morante", 3],
  ["Olga Tokarczuk", 3],
  ["Wisława Szymborska", 3],
  ["Svetlana Alexievitch", 3],
  ["Anna Akhmatova", 4],
  ["Nadejda Mandelstam", 5],
  ["Selma Lagerlöf", 3],
];

const additionalWriters: Array<[string, number]> = [
  ["Victor Hugo", 1],
  ["Émile Zola", 2],
  ["Honoré de Balzac", 2],
  ["Gustave Flaubert", 2],
  ["Marcel Proust", 4],
  ["Albert Camus", 1],
  ["Jean-Paul Sartre", 3],
  ["Guy de Maupassant", 1],
  ["Stendhal", 3],
  ["Jules Verne", 1],
  ["Alexandre Dumas", 1],
  ["Charles Baudelaire", 2],
  ["Arthur Rimbaud", 2],
  ["Paul Verlaine", 2],
  ["Guillaume Apollinaire", 3],
  ["André Gide", 3],
  ["Louis-Ferdinand Céline", 3],
  ["Jean Giono", 3],
  ["Antoine de Saint-Exupéry", 1],
  ["Romain Gary", 2],
  ["Molière", 1],
  ["Jean Racine", 3],
  ["Pierre Corneille", 3],
  ["Edmond Rostand", 2],
  ["Alfred de Musset", 3],
  ["Eugène Ionesco", 3],
  ["Samuel Beckett", 4],
  ["Jean Genet", 4],
  ["Yasmina Reza", 2],
  ["Aimé Césaire", 3],
  ["Léopold Sédar Senghor", 3],
  ["René Char", 4],
  ["Michel Houellebecq", 2],
  ["Patrick Modiano", 2],
  ["Mathias Énard", 4],
  ["François Rabelais", 4],
  ["Michel de Montaigne", 4],
  ["Jean de La Fontaine", 2],
  ["Chrétien de Troyes", 4],
  ["Pierre de Ronsard", 3],
  ["William Shakespeare", 1],
  ["Charles Dickens", 2],
  ["George Orwell", 1],
  ["Aldous Huxley", 2],
  ["Oscar Wilde", 2],
  ["James Joyce", 5],
  ["Joseph Conrad", 3],
  ["D. H. Lawrence", 3],
  ["Thomas Hardy", 3],
  ["Rudyard Kipling", 2],
  ["J. R. R. Tolkien", 1],
  ["C. S. Lewis", 2],
  ["H. G. Wells", 2],
  ["Arthur Conan Doyle", 1],
  ["Bram Stoker", 2],
  ["Lewis Carroll", 2],
  ["Salman Rushdie", 4],
  ["Kazuo Ishiguro", 2],
  ["Harold Pinter", 4],
  ["Tom Stoppard", 4],
  ["Ernest Hemingway", 1],
  ["F. Scott Fitzgerald", 1],
  ["John Steinbeck", 2],
  ["William Faulkner", 4],
  ["Edgar Allan Poe", 1],
  ["Mark Twain", 2],
  ["Herman Melville", 3],
  ["Jack London", 1],
  ["Henry James", 4],
  ["J. D. Salinger", 2],
  ["Kurt Vonnegut", 2],
  ["Ray Bradbury", 1],
  ["Philip K. Dick", 2],
  ["Isaac Asimov", 1],
  ["Frank Herbert", 2],
  ["Cormac McCarthy", 3],
  ["Truman Capote", 2],
  ["Tennessee Williams", 2],
  ["Arthur Miller", 2],
  ["Eugene O’Neill", 4],
  ["Franz Kafka", 2],
  ["Thomas Mann", 4],
  ["Hermann Hesse", 2],
  ["Bertolt Brecht", 3],
  ["Stefan Zweig", 2],
  ["Rainer Maria Rilke", 4],
  ["Johann Wolfgang von Goethe", 4],
  ["Friedrich Schiller", 4],
  ["Fiodor Dostoïevski", 2],
  ["Léon Tolstoï", 2],
  ["Anton Tchekhov", 2],
  ["Nicolas Gogol", 3],
  ["Alexandre Pouchkine", 3],
  ["Mikhaïl Boulgakov", 3],
  ["Haruki Murakami", 1],
  ["Yukio Mishima", 3],
  ["Kenzaburō Ōe", 4],
  ["Gabriel García Márquez", 2],
  ["Jorge Luis Borges", 4],
  ["Mario Vargas Llosa", 3],
];

const literaryFigures = [...womenWriters, ...additionalWriters];

const literatureTopics: Topic[] = literaryFigures.map(([title, difficulty], index) => ({
  category: "LITTÉRATURE",
  title,
  difficulty,
  constraint: literatureConstraints[index % literatureConstraints.length],
  accent: "#c19cff",
}));

const artistTopics: Topic[] = artists.map(({ title, region, difficulty }, index) => ({
  category: "ART",
  title,
  region,
  difficulty,
  constraint: getArtistConstraint(index),
  accent: "#ff8ec7",
}));

const artMovementTopics: Topic[] = artMovements.map(({ title, difficulty }, index) => ({
  category: "ART",
  title,
  difficulty,
  constraint: getArtMovementConstraint(index),
  accent: "#ffca45",
}));

const philosophyTopics: Topic[] = philosophyMovements.map(({ title, difficulty }, index) => ({
  category: "PHILOSOPHIE",
  title,
  difficulty,
  constraint: getPhilosophyConstraint(index),
  accent: "#8ed6a8",
}));

const socialScienceTopics: Topic[] = socialScienceTheories.map(({ title, difficulty }, index) => ({
  category: "SCIENCES SOCIALES",
  title,
  difficulty,
  constraint: getSocialScienceConstraint(index),
  accent: "#55b9ff",
}));

const politicalTopics: Topic[] = politicalMovements.map(({ title, difficulty }, index) => ({
  category: "POLITIQUE",
  title,
  difficulty,
  constraint: getPoliticalConstraint(index),
  accent: "#ff5b35",
}));

const politicalFigureTopics: Topic[] = politicalFigures.map(({ title, difficulty }, index) => ({
  category: "POLITIQUE",
  title,
  difficulty,
  constraint: getPoliticalFigureConstraint(index),
  accent: "#ff5b35",
}));

const scientistTopics: Topic[] = scientists.map(({ title, difficulty }, index) => ({
  category: "SCIENCES",
  title,
  difficulty,
  constraint: getScientistConstraint(index),
  accent: "#55b9ff",
}));

const internetFigureTopics: Topic[] = internetFigures.map(({ title, difficulty }, index) => ({
  category: "INTERNET",
  title,
  difficulty,
  constraint: getInternetFigureConstraint(index),
  accent: "#dfff43",
}));

const internetCultureTopics: Topic[] = internetTopics.map(({ title, difficulty }, index) => ({
  category: "INTERNET",
  title,
  difficulty,
  constraint: getInternetTopicConstraint(index),
  accent: "#dfff43",
}));

const historicalPeriodTopics: Topic[] = historicalPeriods.map(({ title, difficulty }, index) => ({
  category: "HISTOIRE",
  title,
  difficulty,
  constraint: getHistoricalPeriodConstraint(index),
  accent: "#ff5b35",
}));

const religiousMovementTopics: Topic[] = religiousMovements.map(({ title, difficulty }, index) => ({
  category: "RELIGION",
  title,
  difficulty,
  constraint: getReligiousMovementConstraint(index),
  accent: "#c19cff",
}));

const socialScienceThinkerTopics: Topic[] = socialScienceThinkers.map(({ title, difficulty }, index) => ({
  category: "SCIENCES SOCIALES",
  title,
  difficulty,
  constraint: getSocialScienceThinkerConstraint(index),
  accent: "#55b9ff",
}));

const philosopherTopics: Topic[] = philosophers.map(({ title, difficulty }, index) => ({
  category: "PHILOSOPHIE",
  title,
  difficulty,
  constraint: getPhilosopherConstraint(index),
  accent: "#8ed6a8",
}));

const countryTopics: Topic[] = countries.map(({ title, difficulty }, index) => ({
  category: "GÉOGRAPHIE",
  title,
  difficulty,
  constraint: getCountryConstraint(index),
  accent: "#dfff43",
}));

const aquaticGeographyTopics: Topic[] = waterGeographyTopics.map(({ title, difficulty }, index) => ({
  category: "GÉOGRAPHIE",
  title,
  difficulty,
  constraint: getWaterGeographyConstraint(index),
  accent: "#55b9ff",
}));

export const topics: Topic[] = [
  { category: "HISTOIRE", title: "La révolte des Taiping", difficulty: 4, constraint: "Ta présentation doit contenir une carte.", accent: "#ff5b35" },
  { category: "SCIENCES", title: "Les lichens", difficulty: 3, constraint: "Explique le sujet sans utiliser de jargon.", accent: "#55b9ff" },
  { category: "GÉOGRAPHIE", title: "Ouagadougou", difficulty: 2, constraint: "Une slide doit être une carte commentée.", accent: "#dfff43" },
  { category: "HISTOIRE", title: "Les égouts de Londres au XIXe siècle", difficulty: 4, constraint: "Ajoute une chronologie de cinq dates maximum.", accent: "#ffca45" },
  { category: "CULTURES", title: "Le théâtre nō", difficulty: 4, constraint: "Maximum 8 slides.", accent: "#c19cff" },
  { category: "HISTOIRE", title: "La République de Weimar", difficulty: 4, constraint: "Explique une controverse autour du sujet.", accent: "#ff5b35" },
  { category: "SCIENCES", title: "Les tardigrades", difficulty: 2, constraint: "Une slide doit contenir un meme exact.", accent: "#55b9ff" },
  { category: "TECHNOLOGIE", title: "L’histoire du téflon", difficulty: 3, constraint: "Aucun texte de plus de 25 mots par slide.", accent: "#dfff43" },
  { category: "CIVILISATIONS", title: "Le royaume d’Aksoum", difficulty: 4, constraint: "Compare deux interprétations historiques.", accent: "#c19cff" },
  ...literatureTopics,
  ...artistTopics,
  ...artMovementTopics,
  ...philosophyTopics,
  ...socialScienceTopics,
  ...politicalTopics,
  ...politicalFigureTopics,
  ...scientistTopics,
  ...internetFigureTopics,
  ...internetCultureTopics,
  ...historicalPeriodTopics,
  ...religiousMovementTopics,
  ...socialScienceThinkerTopics,
  ...philosopherTopics,
  ...countryTopics,
  ...aquaticGeographyTopics,
];
