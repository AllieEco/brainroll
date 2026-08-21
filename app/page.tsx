"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { topics, type Topic } from "../data/topics";

type Source = { id: string; title: string; url: string };
type Card = { id: string; front: string; back: string };
type SlideBlock = "title" | "body";
type BlockPosition = { x: number; y: number; width: number; height?: number; fontSize?: number };
type SlideImage = { id: string; src: string; position: BlockPosition };
type SlideTarget = { kind: "block"; block: SlideBlock } | { kind: "image"; id: string };
type Slide = { id: string; title: string; body: string; background?: string; color?: string; image?: string; images?: SlideImage[]; layout?: "impact" | "canvas"; positions?: Partial<Record<SlideBlock | "image", BlockPosition>> };
type MindNode = { id: string; text: string; x: number; y: number; color: string; parentId?: string };
type GameMode = "classic" | "fast";
type ThemeMode = "light" | "dark";
type CountdownStep = 3 | 2 | 1 | "GO!";
type Session = {
  topic: Topic;
  mode: GameMode;
  durationSeconds: number;
  endsAt: number;
  notes: string;
  sources: Source[];
  cards: Card[];
  slides: Slide[];
  mindMap?: MindNode[];
  locked: boolean;
};
type Screen = "home" | "topics" | "roll" | "workspace" | "over" | "present";
type Tab = "notes" | "sources" | "cards" | "mindmap" | "slides";

const SESSION_KEY = "brainroll-session-v1";
const THEME_KEY = "brainroll-theme";
const TOPICS_PER_PAGE = 50;
const MAX_REROLLS = 3;
const TOPIC_THEMES = Array.from(new Set(topics.map((entry) => entry.category))).sort((a, b) => a.localeCompare(b, "fr"));
const MODE_CONFIG = {
  classic: { label: "CLASSIQUE", durationSeconds: 60 * 60 },
  fast: { label: "FAST", durationSeconds: 30 * 60 },
} as const;
const uid = () => Math.random().toString(36).slice(2, 9);
const freshSlide = (n = 1): Slide => ({ id: uid(), title: n === 1 ? "Titre de la présentation" : `Slide ${n}`, body: n === 1 ? "Une phrase qui donne envie d’écouter la suite." : "Ajoute ton idée essentielle ici.", background: "#f2efe6", color: "#191815", layout: "impact" });
const formatTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
const BLOCK_PRESETS: Record<"impact" | "canvas", Record<SlideBlock | "image", BlockPosition>> = {
  impact: { title: { x: 8, y: 22, width: 78, height: 20, fontSize: 58 }, body: { x: 8, y: 57, width: 62, height: 17, fontSize: 21 }, image: { x: 63, y: 18, width: 30, height: 55 } },
  canvas: { title: { x: 7, y: 20, width: 50, height: 21, fontSize: 46 }, body: { x: 7, y: 56, width: 48, height: 24, fontSize: 19 }, image: { x: 62, y: 18, width: 31, height: 62 } },
};
const TITLE_SIZES = [32, 38, 46, 54, 58, 64, 72, 80, 92];
const BODY_SIZES = [14, 16, 18, 21, 24, 28, 32, 36, 42];
const MINDMAP_WORLD = { minX: -350, minY: -190, width: 1600, height: 900 } as const;
function resolvedBlockPosition(slide: Slide, block: SlideBlock | "image"): BlockPosition {
  const preset = BLOCK_PRESETS[slide.layout ?? "impact"][block];
  const position = { ...preset, ...slide.positions?.[block] };
  if (block === "title" && position.height === 28) position.height = preset.height;
  if (block === "body" && (position.height === 24 || position.height === 30)) position.height = preset.height;
  return position;
}
function slideImages(slide: Slide): SlideImage[] {
  if (slide.images?.length) return slide.images;
  return slide.image ? [{ id: "legacy-image", src: slide.image, position: resolvedBlockPosition(slide, "image") }] : [];
}
function contrastingTextColor(background: string) {
  const value = background.replace("#", "");
  const hex = value.length === 3 ? value.split("").map((character) => character + character).join("") : value;
  if (!/^[0-9a-f]{6}$/i.test(hex)) return "#191815";
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  return (red * 299 + green * 587 + blue * 114) / 1000 > 128 ? "#191815" : "#fffdf7";
}
function mindNodeMetrics(text: string, root: boolean) {
  const minimumWidth = root ? 210 : 154;
  const maximumWidth = root ? 330 : 280;
  const minimumHeight = root ? 90 : 72;
  const longestParagraph = Math.max(1, ...text.split("\n").map((line) => line.length));
  const width = Math.min(maximumWidth, Math.max(minimumWidth, 104 + Math.min(longestParagraph, 34) * 5.2));
  const charactersPerLine = Math.max(10, Math.floor((width - 50) / 8));
  const lineCount = Math.max(1, text.split("\n").reduce((count, line) => count + Math.max(1, Math.ceil(line.length / charactersPerLine)), 0));
  return { width, height: Math.max(minimumHeight, 48 + lineCount * 22), lineCount };
}
const plainText = (value: string) => value.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
function sanitizeRichText(value: string) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<span\b[^>]*style=["'][^"']*background(?:-color)?\s*:[^"']*["'][^>]*>/gi, "<mark>")
    .replace(/<\/span>/gi, "</mark>")
    .replace(/<(?!\/?(?:b|strong|u|mark|br|div|p)(?:\s|>|\/))[^>]*>/gi, "")
    .replace(/<(b|strong|u|mark|br|div|p)\b[^>]*>/gi, "<$1>");
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [topic, setTopic] = useState(topics[0]);
  const [selectedMode, setSelectedMode] = useState<GameMode>("classic");
  const [rolling, setRolling] = useState(false);
  const [rerollsUsed, setRerollsUsed] = useState(0);
  const [session, setSession] = useState<Session | null>(null);
  const [tab, setTab] = useState<Tab>("notes");
  const [secondsLeft, setSecondsLeft] = useState(3600);
  const [sourceDraft, setSourceDraft] = useState({ title: "", url: "" });
  const [cardDraft, setCardDraft] = useState({ front: "", back: "" });
  const [slideIndex, setSlideIndex] = useState(0);
  const [presentIndex, setPresentIndex] = useState(0);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [topicPage, setTopicPage] = useState(0);
  const [selectedThemes, setSelectedThemes] = useState<string[]>(TOPIC_THEMES);
  const [topicDifficulty, setTopicDifficulty] = useState<number | "all">("all");
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [countdownStep, setCountdownStep] = useState<CountdownStep | null>(null);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_KEY);
    const initialTheme: ThemeMode = savedTheme === "dark" || savedTheme === "light" ? savedTheme : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    setTheme(initialTheme);
    document.documentElement.dataset.theme = initialTheme;
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem(SESSION_KEY);
    if (!saved) return;
    try {
      const restored = JSON.parse(saved) as Session;
      const locked = restored.locked || Date.now() >= restored.endsAt;
      const mode = restored.mode ?? "classic";
      const next = { ...restored, mode, durationSeconds: restored.durationSeconds ?? MODE_CONFIG[mode].durationSeconds, locked, mindMap: restored.mindMap ?? [] };
      setSession(next);
      setSecondsLeft(Math.max(0, Math.ceil((next.endsAt - Date.now()) / 1000)));
      setScreen(locked ? "over" : "home");
    } catch { window.localStorage.removeItem(SESSION_KEY); }
  }, []);

  useEffect(() => {
    if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }, [session]);

  useEffect(() => {
    if (!session || session.locked) return;
    const check = () => {
      const left = Math.max(0, Math.ceil((session.endsAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (Date.now() >= session.endsAt) {
        setSession((current) => current ? { ...current, locked: true } : current);
        setScreen("over");
      }
    };
    check();
    const timer = window.setInterval(check, 250);
    return () => window.clearInterval(timer);
  }, [session?.endsAt, session?.locked]);

  useEffect(() => {
    if (screen !== "present") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === " ") setPresentIndex((i) => Math.min((session?.slides.length ?? 1) - 1, i + 1));
      if (event.key === "ArrowLeft") setPresentIndex((i) => Math.max(0, i - 1));
      if (event.key === "Escape") setScreen(session?.locked ? "over" : "workspace");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, session?.locked, session?.slides.length]);

  useEffect(() => {
    if (countdownStep === null) return;
    const nextStep: Record<CountdownStep, CountdownStep | null> = { 3: 2, 2: 1, 1: "GO!", "GO!": null };
    const delay = countdownStep === "GO!" ? 850 : 700;
    const timer = window.setTimeout(() => {
      const next = nextStep[countdownStep];
      if (next === null) {
        launchSession();
        setCountdownStep(null);
      } else {
        setCountdownStep(next);
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [countdownStep]);

  const progress = useMemo(() => session ? Math.max(0, Math.min(100, (secondsLeft / session.durationSeconds) * 100)) : 100, [secondsLeft, session]);
  const filteredTopics = useMemo(() => {
    return topics.filter((entry) => selectedThemes.includes(entry.category) && (topicDifficulty === "all" || entry.difficulty === topicDifficulty));
  }, [selectedThemes, topicDifficulty]);
  const topicPageCount = Math.max(1, Math.ceil(filteredTopics.length / TOPICS_PER_PAGE));
  const visibleTopics = filteredTopics.slice(topicPage * TOPICS_PER_PAGE, (topicPage + 1) * TOPICS_PER_PAGE);

  function roll(mode = selectedMode, countAsReroll = false) {
    if (rolling || (countAsReroll && rerollsUsed >= MAX_REROLLS)) return;
    if (countAsReroll) setRerollsUsed((current) => current + 1);
    const pool = mode === "fast" ? topics.filter((candidate) => candidate.difficulty === 1) : topics;
    setRolling(true);
    let ticks = 0;
    const shuffle = window.setInterval(() => {
      setTopic(pool[Math.floor(Math.random() * pool.length)]);
      ticks++;
      if (ticks >= 8) { window.clearInterval(shuffle); setRolling(false); }
    }, 90);
  }

  function chooseMode(mode: GameMode) {
    setSelectedMode(mode);
    setRerollsUsed(0);
    setScreen("roll");
    window.setTimeout(() => roll(mode), 80);
  }

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem(THEME_KEY, nextTheme);
  }

  function startSession() {
    if (rolling || countdownStep !== null) return;
    setCountdownStep(3);
  }

  function launchSession() {
    const durationSeconds = MODE_CONFIG[selectedMode].durationSeconds;
    const next: Session = { topic, mode: selectedMode, durationSeconds, endsAt: Date.now() + durationSeconds * 1000, notes: "", sources: [], cards: [], slides: [freshSlide()], mindMap: [], locked: false };
    setSession(next);
    setSecondsLeft(durationSeconds);
    setTab("notes");
    setScreen("workspace");
  }

  function updateSession(patch: Partial<Session>) {
    setSession((current) => current && !current.locked ? { ...current, ...patch } : current);
  }

  function addSource() {
    if (!session || (!sourceDraft.title.trim() && !sourceDraft.url.trim())) return;
    updateSession({ sources: [...session.sources, { id: uid(), title: sourceDraft.title.trim() || sourceDraft.url.trim(), url: sourceDraft.url.trim() }] });
    setSourceDraft({ title: "", url: "" });
  }

  function addCard() {
    if (!session || !cardDraft.front.trim()) return;
    updateSession({ cards: [...session.cards, { id: uid(), front: cardDraft.front.trim(), back: cardDraft.back.trim() }] });
    setCardDraft({ front: "", back: "" });
  }

  function updateSlide(patch: Partial<Slide>) {
    if (!session) return;
    updateSession({ slides: session.slides.map((slide, i) => i === slideIndex ? { ...slide, ...patch } : slide) });
  }

  function updateSlideBlock(block: SlideBlock, patch: Partial<BlockPosition>) {
    if (!session) return;
    const slide = session.slides[slideIndex];
    const preset = BLOCK_PRESETS[slide.layout ?? "impact"][block];
    updateSlide({ positions: { ...slide.positions, [block]: { ...preset, ...slide.positions?.[block], ...patch } } });
  }

  function addSlide() {
    if (!session) return;
    const next = [...session.slides, freshSlide(session.slides.length + 1)];
    updateSession({ slides: next });
    setSlideIndex(next.length - 1);
  }

  function deleteSlide() {
    if (!session || session.slides.length === 1) return;
    const next = session.slides.filter((_, i) => i !== slideIndex);
    updateSession({ slides: next });
    setSlideIndex(Math.max(0, slideIndex - 1));
  }

  function clearSession() {
    window.localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setScreen("home");
  }

  function abandonSession() {
    window.localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setConfirmAbandon(false);
    setScreen("home");
  }

  function addImageToSlide(file: File) {
    if (!file.type.startsWith("image/") || file.size > 2_500_000) return;
    const currentSlide = session?.slides[slideIndex];
    if (!currentSlide) return;
    const reader = new FileReader();
    reader.onload = () => {
      const existingImages = slideImages(currentSlide);
      const offset = existingImages.length % 6;
      const position: BlockPosition = {
        ...BLOCK_PRESETS.canvas.image,
        x: Math.min(68, 58 + offset * 2),
        y: Math.min(42, 14 + offset * 5),
      };
      updateSlide({
        image: undefined,
        images: [...existingImages, { id: uid(), src: String(reader.result), position }],
        layout: "canvas",
        positions: currentSlide.layout === "canvas" ? currentSlide.positions : BLOCK_PRESETS.canvas,
      });
    };
    reader.readAsDataURL(file);
  }

  if (screen === "present" && session) {
    const slide = session.slides[presentIndex] ?? session.slides[0];
    return (
      <main className="presentation" style={{ "--topic-accent": session.topic.accent } as React.CSSProperties}>
        <div className="present-top"><span>⚄ BRAINROLL</span><div><ThemeToggle theme={theme} onToggle={toggleTheme} /><span>{presentIndex + 1} / {session.slides.length}</span></div></div>
        <div className="presentation-stage">
          <section className="slide-surface present-slide freeform-slide" style={{ background: slide.background ?? "#f2efe6", color: slide.color ?? "#191815" }}>
            <span className="slide-kicker">{session.topic.category} · {session.topic.title}</span>
            <div className="present-block slide-title-text" style={blockStyle(resolvedBlockPosition(slide, "title"))} dangerouslySetInnerHTML={{ __html: sanitizeRichText(slide.title) }} />
            <div className="present-block slide-body-text" style={blockStyle(resolvedBlockPosition(slide, "body"))} dangerouslySetInnerHTML={{ __html: sanitizeRichText(slide.body) }} />
            {slideImages(slide).map((image, imageIndex) => <div key={image.id} className="present-block present-image" style={blockStyle(image.position)}><img src={image.src} alt={`Visuel ${imageIndex + 1} de la slide`} /></div>)}
            <i className="slide-number">{String(presentIndex + 1).padStart(2, "0")}</i>
          </section>
        </div>
        <div className="present-controls">
          <button aria-label="Slide précédente" onClick={() => setPresentIndex(Math.max(0, presentIndex - 1))}>←</button>
          <button onClick={() => document.documentElement.requestFullscreen?.()}>PLEIN ÉCRAN</button>
          <button aria-label="Slide suivante" onClick={() => setPresentIndex(Math.min(session.slides.length - 1, presentIndex + 1))}>→</button>
          <button onClick={() => setScreen(session.locked ? "over" : "workspace")}>QUITTER</button>
        </div>
      </main>
    );
  }

  if (screen === "over" && session) {
    return (
      <main className="over-screen" style={{ "--topic-accent": session.topic.accent } as React.CSSProperties}>
        <ThemeToggle theme={theme} onToggle={toggleTheme} extraClass="over-theme-toggle" />
        <div className="over-stamp">00:00 · READ ONLY</div>
        <div className="lock-icon">⌁</div>
        <p className="eyebrow">TIME&apos;S UP</p>
        <h1>RESEARCH OVER.<br /><em>DEFEND YOUR KNOWLEDGE.</em></h1>
        <p className="over-topic">{session.topic.title}</p>
        <div className="over-stats"><span><b>{session.sources.length}</b> sources</span><span><b>{session.cards.length}</b> flashcards</span><span><b>{session.slides.length}</b> slides</span></div>
        <button className="primary" onClick={() => { setPresentIndex(0); setScreen("present"); }}>START PRESENTATION <span>→</span></button>
        <button className="text-button" onClick={clearSession}>NOUVEAU BRAINROLL</button>
      </main>
    );
  }

  return (
    <main className={`shell ${screen === "workspace" ? "workspace-shell" : ""}`} style={{ "--topic-accent": session?.topic.accent ?? topic.accent } as React.CSSProperties}>
      <nav className="topbar">
        <button className="brand" onClick={() => setScreen("home")}><span className="brand-die">⚄</span> BRAINROLL</button>
        {screen === "workspace" && session ? (
          <div className="workspace-top-actions"><ThemeToggle theme={theme} onToggle={toggleTheme} /><div className={`timer ${secondsLeft <= 300 ? "urgent" : ""}`}><span className="timer-dot" /> {formatTime(secondsLeft)}</div></div>
        ) : <div className="topbar-actions"><ThemeToggle theme={theme} onToggle={toggleTheme} /><button className={`topics-tab ${screen === "topics" ? "active" : ""}`} onClick={() => setScreen(screen === "topics" ? "home" : "topics")}>{screen === "topics" ? "FERMER LA LISTE" : "VOIR LA LISTE DES SUJETS"}</button><div className="top-meta"><span className={session ? "live-dot active" : "live-dot"} /> {session ? "SESSION SAVED" : "NO SESSION RUNNING"}</div></div>}
      </nav>

      {screen === "home" && (
        <section className="hero">
          <div className="eyebrow">A KNOWLEDGE SPEEDRUN</div>
          <h1>ROLL THE DICE.<br /><em>FEED YOUR BRAIN.</em></h1>
          <p className="lede">Un sujet. Trente ou soixante minutes. Une présentation.<br />Jusqu&apos;où peut aller ta curiosité avant la fin du chrono ?</p>
          {session && !session.locked ? (
            <div className="resume-box"><span>{MODE_CONFIG[session.mode].label} · PARTIE EN COURS · {session.topic.title}</span><button className="primary" onClick={() => setScreen("workspace")}>REPRENDRE · {formatTime(secondsLeft)} <span>→</span></button></div>
          ) : (
            <div className="mode-picker" aria-label="Choisir un mode de jeu">
              <button className="mode-button classic" onClick={() => chooseMode("classic")}><span>CLASSIQUE</span><strong>60&apos;00</strong><small>TOUTES DIFFICULTÉS</small></button>
              <button className="mode-button fast" onClick={() => chooseMode("fast")}><span>FAST</span><strong>30&apos;00</strong><small>SUJETS ★ UNIQUEMENT</small></button>
            </div>
          )}
          <div className="loop" aria-label="Les cinq étapes du jeu">{["ROLL", "RESEARCH", "UNDERSTAND", "BUILD", "PRESENT"].map((step, i) => <span key={step}>{i > 0 && <b>→</b>}{step}</span>)}</div>
        </section>
      )}

      {screen === "topics" && (
        <section className="topics-catalog">
          <header className="catalog-heading">
            <div><span className="eyebrow">THE FULL BRAINROLL</span><h1>LISTE DES SUJETS</h1><p>{filteredTopics.length === topics.length ? `${topics.length} sujets disponibles` : `${filteredTopics.length} résultat${filteredTopics.length > 1 ? "s" : ""} sur ${topics.length}`}, présentés par tranches de 50.</p></div>
            <div className="catalog-range"><span>TRANCHE</span><strong>{filteredTopics.length ? topicPage * TOPICS_PER_PAGE + 1 : 0}–{Math.min((topicPage + 1) * TOPICS_PER_PAGE, filteredTopics.length)}</strong><small>SUR {filteredTopics.length}</small></div>
          </header>
          <div className="catalog-filters">
            <details className="theme-menu"><summary><span>THÈMES</span><strong>{selectedThemes.length} / {TOPIC_THEMES.length}</strong></summary><div className="theme-dropdown"><div className="theme-filter-actions"><button type="button" onClick={() => { setSelectedThemes(TOPIC_THEMES); setTopicPage(0); }}>TOUT COCHER</button><button type="button" onClick={() => { setSelectedThemes([]); setTopicPage(0); }}>TOUT DÉCOCHER</button></div><div className="theme-checkboxes">{TOPIC_THEMES.map((theme) => <label key={theme}><input type="checkbox" checked={selectedThemes.includes(theme)} onChange={() => { setSelectedThemes((current) => current.includes(theme) ? current.filter((entry) => entry !== theme) : [...current, theme]); setTopicPage(0); }} /><span>{theme}</span></label>)}</div></div></details>
            <label className="difficulty-filter"><span>DIFFICULTÉ</span><select value={topicDifficulty} onChange={(event) => { setTopicDifficulty(event.target.value === "all" ? "all" : Number(event.target.value)); setTopicPage(0); }}><option value="all">TOUTES</option>{[1, 2, 3, 4, 5].map((level) => <option value={level} key={level}>{"★".repeat(level)}{"☆".repeat(5 - level)}</option>)}</select></label>
            {(selectedThemes.length !== TOPIC_THEMES.length || topicDifficulty !== "all") && <button className="reset-catalog-filters" onClick={() => { setSelectedThemes(TOPIC_THEMES); setTopicDifficulty("all"); setTopicPage(0); }}>RÉINITIALISER ×</button>}
          </div>
          {!!visibleTopics.length && <TopicPagination page={topicPage} pageCount={topicPageCount} total={filteredTopics.length} onChange={setTopicPage} />}
          <div className="topics-table" role="table" aria-label="Liste des sujets Brainroll">
            <div className="topic-row topic-table-head" role="row"><span>#</span><span>SUJET</span><span>THÈME</span><span>DIFFICULTÉ</span></div>
            {visibleTopics.map((entry, index) => <div className="topic-row" role="row" key={`${entry.category}-${entry.title}-${topicPage * TOPICS_PER_PAGE + index}`} style={{ "--row-accent": entry.accent } as React.CSSProperties}><span>{String(topicPage * TOPICS_PER_PAGE + index + 1).padStart(3, "0")}</span><strong>{entry.title}</strong><span>{entry.category}</span><span className="catalog-difficulty" aria-label={`${entry.difficulty} étoiles sur 5`}>{"★".repeat(entry.difficulty)}<i>{"☆".repeat(5 - entry.difficulty)}</i></span></div>)}
            {!visibleTopics.length && <div className="catalog-empty"><span>⌕</span><strong>AUCUN SUJET TROUVÉ</strong><p>Essaie un autre nom ou une autre difficulté.</p></div>}
          </div>
          {!!visibleTopics.length && <TopicPagination page={topicPage} pageCount={topicPageCount} total={filteredTopics.length} onChange={setTopicPage} />}
        </section>
      )}

      {screen === "roll" && (
        <section className="roll-screen">
          <div className="eyebrow">{MODE_CONFIG[selectedMode].label} MODE · YOUR NEXT OBSESSION</div>
          <div className={`dice ${rolling ? "is-rolling" : ""}`} aria-hidden="true">⚄</div>
          <article className="topic-card" style={{ borderTopColor: topic.accent }}>
            <span className="category">{rolling ? "SEARCHING..." : topic.category}</span>
            <h2>{rolling ? "????????" : topic.title}</h2>
            {!rolling && topic.region && <div className="topic-region">{topic.region}</div>}
            <div className="difficulty"><span>DIFFICULTY</span> {"★".repeat(topic.difficulty)}{"☆".repeat(5 - topic.difficulty)}</div>
            {selectedMode === "classic" && <div className="constraint"><small>CHAOS CONSTRAINT</small><strong>{topic.constraint}</strong></div>}
          </article>
          <div className="roll-actions"><button className="secondary" onClick={() => roll(selectedMode, true)} disabled={rolling || rerollsUsed >= MAX_REROLLS}>{rerollsUsed >= MAX_REROLLS ? "REROLLS ÉPUISÉS" : `↻ REROLL · ${MAX_REROLLS - rerollsUsed} RESTANT${MAX_REROLLS - rerollsUsed > 1 ? "S" : ""}`}</button><button className="primary" onClick={startSession} disabled={rolling}>GO <span>→</span></button></div>
          <p className="go-warning">Le chrono de {MODE_CONFIG[selectedMode].durationSeconds / 60} minutes démarre au clic.{selectedMode === "fast" ? " Tirage limité aux sujets ★." : ""}</p>
        </section>
      )}

      {screen === "workspace" && session && (
        <section className="workspace">
          <header className="challenge-strip">
            <div><span>{MODE_CONFIG[session.mode].label} · {session.topic.category}</span><strong>{session.topic.title}</strong></div>
            {session.mode === "classic" && <div className="constraint-mini"><span>CONTRAINTE</span><strong>{session.topic.constraint}</strong></div>}
            <div className="session-actions"><span className="autosave">✓ SAUVEGARDÉ</span><button onClick={() => setConfirmAbandon(true)}>ABANDONNER</button></div>
          </header>
          <div className="time-progress"><i style={{ width: `${progress}%` }} /></div>
          <div className="work-layout">
            <aside>
              <div className="aside-label">TOOLS, NOT CHECKLIST.</div>
              {([['notes','✎','NOTES'],['sources','⌕','SOURCES'],['cards','▱','FLASHCARDS'],['mindmap','⌘','CARTE MENTALE'],['slides','▣','SLIDES']] as const).map(([id, icon, label]) => (
                <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}><b>{icon}</b><span>{label}</span><em>{id === "sources" ? session.sources.length : id === "cards" ? session.cards.length : id === "slides" ? session.slides.length : ""}</em></button>
              ))}
              <div className="aside-bottom"><span>TIME LEFT</span><strong>{formatTime(secondsLeft)}</strong><button onClick={() => { setPresentIndex(0); setScreen("present"); }}>PREVIEW ↗</button></div>
            </aside>
            <div className="work-panel">
              {tab === "notes" && <NotesPanel session={session} onChange={(notes) => updateSession({ notes })} />}
              {tab === "sources" && (
                <Panel title="Sources" eyebrow="BUILD YOUR EVIDENCE" count={`${session.sources.length} SAVED`}>
                  <div className="source-form"><input aria-label="Titre de la source" placeholder="Titre de la source" value={sourceDraft.title} onChange={(e) => setSourceDraft({ ...sourceDraft, title: e.target.value })} /><input aria-label="Adresse de la source" placeholder="https://..." value={sourceDraft.url} onChange={(e) => setSourceDraft({ ...sourceDraft, url: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addSource()} /><button onClick={addSource}>+ AJOUTER</button></div>
                  <div className="item-list">{session.sources.length ? session.sources.map((source, i) => <article className="source-item" key={source.id}><span>{String(i + 1).padStart(2, "0")}</span><div><strong>{source.title}</strong><a href={source.url} target="_blank" rel="noreferrer">{source.url || "Aucune URL"}</a></div><button aria-label={`Supprimer ${source.title}`} onClick={() => updateSession({ sources: session.sources.filter((s) => s.id !== source.id) })}>×</button></article>) : <Empty text="Tes meilleures rabbit holes apparaîtront ici." />}</div>
                </Panel>
              )}
              {tab === "cards" && (
                <Panel title="Flashcards" eyebrow="MAKE IT STICK" count={`${session.cards.length} CARDS`}>
                  <div className="card-form"><textarea aria-label="Recto" placeholder="RECTO — Question ou concept" value={cardDraft.front} onChange={(e) => setCardDraft({ ...cardDraft, front: e.target.value })} /><textarea aria-label="Verso" placeholder="VERSO — Réponse" value={cardDraft.back} onChange={(e) => setCardDraft({ ...cardDraft, back: e.target.value })} /><button onClick={addCard}>+ CRÉER LA CARTE</button></div>
                  <div className="cards-grid">{session.cards.length ? session.cards.map((card, i) => <Flashcard key={card.id} card={card} index={i} onDelete={() => updateSession({ cards: session.cards.filter((entry) => entry.id !== card.id) })} />) : <Empty text="Transforme les idées importantes en questions." />}</div>
                </Panel>
              )}
              {tab === "mindmap" && <MindMapPanel session={session} onChange={(mindMap) => updateSession({ mindMap })} onAddToSlide={(image) => { const next = [...session.slides, { ...freshSlide(session.slides.length + 1), title: "Carte mentale", body: "", images: [{ id: uid(), src: image, position: BLOCK_PRESETS.canvas.image }], layout: "canvas" as const }]; updateSession({ slides: next }); setSlideIndex(next.length - 1); setTab("slides"); }} />}
              {tab === "slides" && (
                <Panel title="Slides" eyebrow="BUILD THE STORY" count={`${session.slides.length} SLIDES`}>
                  <div className="slides-editor">
                    <div className="slide-list">{session.slides.map((slide, i) => <button className={i === slideIndex ? "active" : ""} key={slide.id} onClick={() => setSlideIndex(i)}><span>{String(i + 1).padStart(2, "0")}</span><b>{plainText(slide.title) || "Sans titre"}</b></button>)}<button className="add-slide" onClick={addSlide}>+ ADD SLIDE</button></div>
                    <div className="slide-stage">
                      <div className="slide-customize">
                        <label>FOND <input type="color" value={session.slides[slideIndex]?.background ?? "#f2efe6"} onChange={(e) => updateSlide({ background: e.target.value })} /></label>
                        <label>TEXTE <input type="color" value={session.slides[slideIndex]?.color ?? "#191815"} onChange={(e) => updateSlide({ color: e.target.value })} /></label>
                        <button className={session.slides[slideIndex]?.layout !== "canvas" ? "active" : ""} onClick={() => updateSlide({ layout: "impact", positions: BLOCK_PRESETS.impact })}>IMPACT</button>
                        <button className={session.slides[slideIndex]?.layout === "canvas" ? "active" : ""} onClick={() => updateSlide({ layout: "canvas", positions: BLOCK_PRESETS.canvas })}>CANVAS + IMAGE</button>
                        <span className="format-divider" />
                        <button className="format-button" title="Gras" aria-label="Mettre le texte sélectionné en gras" onMouseDown={(e) => { e.preventDefault(); document.execCommand("bold"); }}><b>B</b></button>
                        <button className="format-button" title="Souligné" aria-label="Souligner le texte sélectionné" onMouseDown={(e) => { e.preventDefault(); document.execCommand("underline"); }}><u>U</u></button>
                        <button className="format-button highlight" title="Surligner" aria-label="Surligner le texte sélectionné" onMouseDown={(e) => { e.preventDefault(); document.execCommand("hiliteColor", false, "#fff176"); }}><mark>A</mark></button>
                        <label className="font-size-control">TITRE <select aria-label="Taille du titre" value={{ ...BLOCK_PRESETS[session.slides[slideIndex]?.layout ?? "impact"].title, ...session.slides[slideIndex]?.positions?.title }.fontSize} onChange={(e) => updateSlideBlock("title", { fontSize: Number(e.target.value) })}>{TITLE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
                        <label className="font-size-control">TEXTE <select aria-label="Taille du texte" value={{ ...BLOCK_PRESETS[session.slides[slideIndex]?.layout ?? "impact"].body, ...session.slides[slideIndex]?.positions?.body }.fontSize} onChange={(e) => updateSlideBlock("body", { fontSize: Number(e.target.value) })}>{BODY_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
                        <label className="image-upload">+ IMAGE<input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) addImageToSlide(file); e.target.value = ""; }} /></label>
                      </div>
                      <p className="slide-editor-hint">Chaque import ajoute une image · Poignée ronde : déplacer · Coin inférieur droit : redimensionner · L’aperçu correspond exactement au mode présentation</p>
                      <SlideCanvas slide={session.slides[slideIndex]} topic={session.topic} index={slideIndex} onChange={updateSlide} />
                      <div className="slide-tools"><button onClick={deleteSlide} disabled={session.slides.length === 1}>SUPPRIMER</button><button onClick={() => { setPresentIndex(0); setScreen("present"); }}>PRÉSENTER ↗</button></div>
                    </div>
                  </div>
                </Panel>
              )}
            </div>
          </div>
        </section>
      )}
      {screen !== "workspace" && <footer><span>LESS BRAINROT. MORE BRAIN.</span><span>{selectedMode === "fast" ? "30:00 · FAST MODE · ★" : "60:00 · CLASSIC MODE"}</span></footer>}
      {countdownStep !== null && (
        <section className={`race-countdown ${countdownStep === "GO!" ? "is-go" : ""}`} role="alert" aria-live="assertive" aria-label={countdownStep === "GO!" ? "Départ" : `Départ dans ${countdownStep}`}>
          <div className="race-speed-lines" aria-hidden="true" />
          <div className="race-countdown-content">
            <span className="race-kicker">BRAINROLL RACE CONTROL</span>
            <strong key={countdownStep} className="race-countdown-number">{countdownStep}</strong>
            <p>{countdownStep === "GO!" ? "THE CLOCK IS RUNNING" : `${MODE_CONFIG[selectedMode].label} MODE · GET READY`}</p>
            <div className="race-lights" aria-hidden="true"><i className="active" /><i className={countdownStep !== 3 ? "active" : ""} /><i className={countdownStep === 1 || countdownStep === "GO!" ? "active" : ""} /></div>
          </div>
        </section>
      )}
      {confirmAbandon && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="abandon-title"><div className="confirm-modal"><span>⚠ DANGER ZONE</span><h2 id="abandon-title">Abandonner la partie ?</h2><p>Le chrono s’arrêtera et toutes les notes, sources, cartes et slides de cette session seront supprimées.</p><div><button className="secondary" onClick={() => setConfirmAbandon(false)}>CONTINUER LA PARTIE</button><button className="danger" onClick={abandonSession}>OUI, ABANDONNER</button></div></div></div>}
    </main>
  );
}

function blockStyle(position: BlockPosition): React.CSSProperties {
  return {
    left: `${position.x}%`,
    top: `${position.y}%`,
    width: `${position.width}%`,
    height: position.height ? `${position.height}%` : undefined,
    fontSize: position.fontSize ? `${position.fontSize / 9.6}cqw` : undefined,
  };
}

function SlideCanvas({ slide, topic, index, onChange }: { slide: Slide; topic: Topic; index: number; onChange: (patch: Partial<Slide>) => void }) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [interaction, setInteraction] = useState<{ mode: "move" | "resize"; target: SlideTarget; startX: number; startY: number; origin: BlockPosition } | null>(null);
  const positionFor = (block: SlideBlock) => resolvedBlockPosition(slide, block);

  function startInteraction(event: React.PointerEvent<HTMLButtonElement>, target: SlideTarget, mode: "move" | "resize", origin: BlockPosition) {
    if (!boardRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setInteraction({ mode, target, startX: event.clientX, startY: event.clientY, origin });
  }

  function updateTargetPosition(target: SlideTarget, position: BlockPosition) {
    if (target.kind === "block") {
      onChange({ positions: { ...slide.positions, [target.block]: position } });
      return;
    }
    onChange({ image: undefined, images: slideImages(slide).map((image) => image.id === target.id ? { ...image, position } : image) });
  }

  function moveInteraction(event: React.PointerEvent<HTMLButtonElement>) {
    if (!interaction || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const deltaX = ((event.clientX - interaction.startX) / rect.width) * 100;
    const deltaY = ((event.clientY - interaction.startY) / rect.height) * 100;
    if (interaction.mode === "move") {
      const x = Math.max(0, Math.min(100 - interaction.origin.width, interaction.origin.x + deltaX));
      const y = Math.max(0, Math.min(100 - (interaction.origin.height ?? 12), interaction.origin.y + deltaY));
      updateTargetPosition(interaction.target, { ...interaction.origin, x, y });
      return;
    }
    const minimumWidth = interaction.target.kind === "image" ? 12 : 18;
    const minimumHeight = interaction.target.kind === "image" ? 12 : 10;
    const width = Math.max(minimumWidth, Math.min(100 - interaction.origin.x, interaction.origin.width + deltaX));
    const height = Math.max(minimumHeight, Math.min(100 - interaction.origin.y, (interaction.origin.height ?? minimumHeight) + deltaY));
    updateTargetPosition(interaction.target, { ...interaction.origin, width, height });
  }

  const handles = (target: SlideTarget, position: BlockPosition, label: string) => <>
    <button className="block-handle" aria-label={`Déplacer ${label}`} title={`Déplacer ${label}`} onPointerDown={(event) => startInteraction(event, target, "move", position)} onPointerMove={moveInteraction} onPointerUp={() => setInteraction(null)} onPointerCancel={() => setInteraction(null)}>⠿</button>
    <button className="resize-handle" aria-label={`Redimensionner ${label}`} title={`Redimensionner ${label}`} onPointerDown={(event) => startInteraction(event, target, "resize", position)} onPointerMove={moveInteraction} onPointerUp={() => setInteraction(null)} onPointerCancel={() => setInteraction(null)}></button>
  </>;

  return (
    <div ref={boardRef} className="slide-surface mini-slide freeform-editor" style={{ background: slide.background, color: slide.color }}>
      <span className="slide-kicker editor-kicker">{topic.category} · {topic.title}</span>
      <div className="editable-block title-block" style={blockStyle(positionFor("title"))}>
        {handles({ kind: "block", block: "title" }, positionFor("title"), "le titre")}
        <RichTextEditor className="slide-title-text slide-title-editor" label="Titre de la slide" value={slide.title} onChange={(title) => onChange({ title })} />
      </div>
      <div className="editable-block body-block" style={blockStyle(positionFor("body"))}>
        {handles({ kind: "block", block: "body" }, positionFor("body"), "le texte")}
        <RichTextEditor className="slide-body-text slide-body-editor" label="Contenu de la slide" value={slide.body} onChange={(body) => onChange({ body })} />
      </div>
      {slideImages(slide).map((image, imageIndex) => (
        <div key={image.id} className="editable-block image-block" style={blockStyle(image.position)}>
          {handles({ kind: "image", id: image.id }, image.position, `l’image ${imageIndex + 1}`)}
          <img src={image.src} alt={`Visuel ajouté ${imageIndex + 1}`} />
          <button className="remove-slide-image" aria-label={`Retirer l’image ${imageIndex + 1}`} onClick={() => onChange({ image: undefined, images: slideImages(slide).filter((entry) => entry.id !== image.id) })}>×</button>
        </div>
      ))}

      <i className="slide-number">{String(index + 1).padStart(2, "0")}</i>
    </div>
  );
}

function RichTextEditor({ value, onChange, className, label }: { value: string; onChange: (value: string) => void; className: string; label: string }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const safeValue = sanitizeRichText(value);

  useEffect(() => {
    if (editorRef.current && document.activeElement !== editorRef.current && editorRef.current.innerHTML !== safeValue) editorRef.current.innerHTML = safeValue;
  }, [safeValue]);

  return <div ref={editorRef} className={className} role="textbox" aria-label={label} aria-multiline="true" contentEditable suppressContentEditableWarning onInput={(event) => onChange(sanitizeRichText(event.currentTarget.innerHTML))} onBlur={(event) => { const clean = sanitizeRichText(event.currentTarget.innerHTML); event.currentTarget.innerHTML = clean; onChange(clean); }} />;
}

function ThemeToggle({ theme, onToggle, extraClass = "" }: { theme: ThemeMode; onToggle: () => void; extraClass?: string }) {
  const dark = theme === "dark";
  return <button className={`theme-toggle ${extraClass}`} type="button" aria-pressed={dark} aria-label={dark ? "Activer le mode clair" : "Activer le mode sombre"} title={dark ? "Mode clair" : "Mode sombre"} onClick={onToggle}><span aria-hidden="true">{dark ? "☀" : "☾"}</span><b>{dark ? "CLAIR" : "SOMBRE"}</b></button>;
}

function TopicPagination({ page, pageCount, total, onChange }: { page: number; pageCount: number; total: number; onChange: (page: number) => void }) {
  function changePage(next: number) {
    onChange(Math.max(0, Math.min(pageCount - 1, next)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return <nav className="topic-pagination" aria-label="Pagination des sujets"><button disabled={page === 0} onClick={() => changePage(page - 1)}>← PRÉCÉDENTS</button><label>VOIR <select value={page} onChange={(event) => changePage(Number(event.target.value))}>{Array.from({ length: pageCount }, (_, index) => <option key={index} value={index}>{index * TOPICS_PER_PAGE + 1}–{Math.min((index + 1) * TOPICS_PER_PAGE, total)}</option>)}</select></label><span>{page + 1} / {pageCount}</span><button disabled={page === pageCount - 1} onClick={() => changePage(page + 1)}>SUIVANTS →</button></nav>;
}

function Panel({ title, eyebrow, count, children }: { title: string; eyebrow: string; count: string; children: React.ReactNode }) {
  return <section className="panel-inner"><header><div><small>{eyebrow}</small><h2>{title}</h2></div><span>{count}</span></header>{children}</section>;
}

function NotesPanel({ session, onChange }: { session: Session; onChange: (value: string) => void }) {
  const words = session.notes.trim() ? session.notes.trim().split(/\s+/).length : 0;
  return <Panel title="Notes" eyebrow="CAPTURE THE CHAOS" count={`${words} WORDS`}><div className="note-toolbar"><button onClick={() => onChange(session.notes + "\n# ")}>H1</button><button onClick={() => onChange(session.notes + "\n## ")}>H2</button><button onClick={() => onChange(session.notes + "**texte**")}>B</button><button onClick={() => onChange(session.notes + "\n• ")}>• LIST</button><span>AUTOSAVE ON</span></div><textarea className="notes-area" aria-label="Notes de recherche" placeholder={'Commence à creuser…\n\nNote les idées essentielles, les dates, les noms et les questions qui apparaissent.'} value={session.notes} onChange={(e) => onChange(e.target.value)} /></Panel>;
}

function Flashcard({ card, index, onDelete }: { card: Card; index: number; onDelete: () => void }) {
  const [flipped, setFlipped] = useState(false);
  const number = String(index + 1).padStart(2, "0");

  return <article className={`flashcard ${flipped ? "is-flipped" : ""}`}>
    <button className="flashcard-flipper" type="button" aria-pressed={flipped} aria-label={`${flipped ? "Afficher le recto" : "Afficher le verso"} de la carte ${number}`} onClick={() => setFlipped((current) => !current)}>
      <span className="flashcard-inner">
        <span className="flashcard-face flashcard-front" aria-hidden={flipped}>
          <span className="flashcard-meta"><small>CARD {number}</small><em>RECTO</em></span>
          <strong>{card.front}</strong>
          <span className="flashcard-cue">CLIQUER POUR RETOURNER <b>↻</b></span>
        </span>
        <span className="flashcard-face flashcard-back" aria-hidden={!flipped}>
          <span className="flashcard-meta"><small>CARD {number}</small><em>VERSO</em></span>
          <p>{card.back || "Réponse à compléter…"}</p>
          <span className="flashcard-cue">REVOIR LA QUESTION <b>↻</b></span>
        </span>
      </span>
    </button>
    <button className="flashcard-delete" type="button" aria-label={`Supprimer la carte ${number}`} onClick={onDelete}>×</button>
  </article>;
}

function MindMapPanel({ session, onChange, onAddToSlide }: { session: Session; onChange: (nodes: MindNode[]) => void; onAddToSlide: (image: string) => void }) {
  const nodes = session.mindMap ?? [];
  const [dragging, setDragging] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const selectedNode = nodes.find((node) => node.id === selectedNodeId);

  useEffect(() => {
    setZoom(nodes.length > 5 ? Math.max(.56, 1 - (nodes.length - 5) * .08) : 1);
    setPan({ x: 0, y: 0 });
  }, [nodes.length]);

  function changeZoom(next: number) {
    setZoom(Math.max(.45, Math.min(1.5, next)));
  }

  function resetView() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  function parentFor(node: MindNode, index: number) {
    if (index === 0) return undefined;
    return nodes.find((candidate) => candidate.id === node.parentId && candidate.id !== node.id) ?? nodes[0];
  }

  function addNode() {
    const index = nodes.length;
    const parent = selectedNode ?? nodes[0];
    const siblings = parent ? nodes.filter((node) => (node.parentId ?? nodes[0]?.id) === parent.id).length : 0;
    const angle = siblings * 1.35 - .7;
    const node: MindNode = index === 0
      ? { id: uid(), text: session.topic.title, x: 450, y: 260, color: session.topic.accent }
      : { id: uid(), text: "Nouvelle idée", x: Math.max(MINDMAP_WORLD.minX + 90, Math.min(MINDMAP_WORLD.minX + MINDMAP_WORLD.width - 90, (parent?.x ?? 450) + Math.cos(angle) * 230)), y: Math.max(MINDMAP_WORLD.minY + 65, Math.min(MINDMAP_WORLD.minY + MINDMAP_WORLD.height - 65, (parent?.y ?? 260) + Math.sin(angle) * 150)), color: ["#dfff43", "#55b9ff", "#ff8ec7", "#ffca45"][index % 4], parentId: parent?.id };
    onChange([...nodes, node]);
    setSelectedNodeId(node.id);
  }

  function deleteNode(nodeId: string) {
    const removedIndex = nodes.findIndex((node) => node.id === nodeId);
    const removed = nodes[removedIndex];
    if (!removed) return;
    const remaining = nodes.filter((node) => node.id !== nodeId);
    const nextRoot = remaining[0];
    const fallbackParentId = removedIndex === 0 ? nextRoot?.id : removed.parentId ?? nodes[0]?.id;
    const next = remaining.map((node, index) => {
      if (index === 0) return { ...node, parentId: undefined };
      return node.parentId === nodeId || !node.parentId ? { ...node, parentId: fallbackParentId } : node;
    });
    onChange(next);
    if (selectedNodeId === nodeId) setSelectedNodeId(fallbackParentId ?? null);
  }

  function moveNode(event: React.PointerEvent<HTMLDivElement>) {
    if (panning) {
      setPan({ x: panning.originX + event.clientX - panning.startX, y: panning.originY + event.clientY - panning.startY });
      return;
    }
    if (!dragging) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(MINDMAP_WORLD.minX + 70, Math.min(MINDMAP_WORLD.minX + MINDMAP_WORLD.width - 70, MINDMAP_WORLD.minX + ((event.clientX - rect.left) / rect.width) * MINDMAP_WORLD.width));
    const y = Math.max(MINDMAP_WORLD.minY + 45, Math.min(MINDMAP_WORLD.minY + MINDMAP_WORLD.height - 45, MINDMAP_WORLD.minY + ((event.clientY - rect.top) / rect.height) * MINDMAP_WORLD.height));
    onChange(nodes.map((node) => node.id === dragging ? { ...node, x, y } : node));
  }

  function renderMap() {
    const canvas = document.createElement("canvas");
    canvas.width = MINDMAP_WORLD.width; canvas.height = MINDMAP_WORLD.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.fillStyle = "#f2efe6"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(25,24,21,.15)"; ctx.lineWidth = 1;
    for (let x = 0; x < 1600; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 900); ctx.stroke(); }
    for (let y = 0; y < 900; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1600, y); ctx.stroke(); }
    const root = nodes[0];
    nodes.slice(1).forEach((node, index) => { const parent = parentFor(node, index + 1); if (!parent) return; ctx.beginPath(); ctx.strokeStyle = "#191815"; ctx.lineWidth = 5; ctx.moveTo(parent.x - MINDMAP_WORLD.minX, parent.y - MINDMAP_WORLD.minY); ctx.lineTo(node.x - MINDMAP_WORLD.minX, node.y - MINDMAP_WORLD.minY); ctx.stroke(); });
    nodes.forEach((node) => {
      const rootNode = node.id === root?.id;
      const metrics = mindNodeMetrics(node.text, rootNode);
      const x = node.x - MINDMAP_WORLD.minX, y = node.y - MINDMAP_WORLD.minY, width = metrics.width, height = metrics.height;
      ctx.fillStyle = node.color; ctx.strokeStyle = "#191815"; ctx.lineWidth = 6;
      ctx.fillRect(x - width / 2, y - height / 2, width, height); ctx.strokeRect(x - width / 2, y - height / 2, width, height);
      ctx.fillStyle = contrastingTextColor(node.color); ctx.font = `900 ${rootNode ? 28 : 22}px Arial`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const words = node.text.split(" "); let line = ""; const lines: string[] = [];
      words.forEach((word) => { const test = `${line} ${word}`.trim(); if (ctx.measureText(test).width > width - 28 && line) { lines.push(line); line = word; } else line = test; }); lines.push(line);
      lines.forEach((text, i) => ctx.fillText(text, x, y + (i - (lines.length - 1) / 2) * 28));
    });
    return canvas.toDataURL("image/png");
  }

  function downloadMap() {
    const image = renderMap(); if (!image) return;
    const link = document.createElement("a"); link.href = image; link.download = `brainroll-carte-mentale.png`; link.click();
  }

  return <Panel title="Carte mentale" eyebrow="CONNECT THE DOTS" count={`${nodes.length} NODES`}>
    <div className="map-toolbar"><button onClick={addNode}>+ AJOUTER UN NŒUD</button><span>{selectedNode ? <>LIÉ À <strong>{selectedNode.text}</strong></> : "Sélectionne une box pour y rattacher la suivante."}</span><div className="map-zoom" aria-label="Zoom de la carte mentale"><button aria-label="Dézoomer" onClick={() => changeZoom(zoom - .1)}>−</button><button aria-label="Réinitialiser la vue" onClick={resetView}>{Math.round(zoom * 100)}%</button><button aria-label="Zoomer" onClick={() => changeZoom(zoom + .1)}>+</button></div><button onClick={downloadMap} disabled={!nodes.length}>↓ PNG</button><button onClick={() => { const image = renderMap(); if (image) onAddToSlide(image); }} disabled={!nodes.length}>+ AJOUTER AUX SLIDES</button></div>
    <div className={`mindmap-viewport ${panning ? "is-panning" : ""}`} onWheel={(event) => { event.preventDefault(); changeZoom(zoom - event.deltaY * .001); }}>
      <div className="mindmap-board" style={{ transform: `translate(-50%,-50%) translate(${pan.x}px,${pan.y}px) scale(${zoom})` }} onPointerDown={(event) => { if (event.target === event.currentTarget) { event.currentTarget.setPointerCapture(event.pointerId); setSelectedNodeId(null); setPanning({ startX: event.clientX, startY: event.clientY, originX: pan.x, originY: pan.y }); } }} onPointerMove={moveNode} onPointerUp={() => { setDragging(null); setPanning(null); }} onPointerCancel={() => { setDragging(null); setPanning(null); }} onPointerLeave={() => { setDragging(null); setPanning(null); }}>
        <svg viewBox={`${MINDMAP_WORLD.minX} ${MINDMAP_WORLD.minY} ${MINDMAP_WORLD.width} ${MINDMAP_WORLD.height}`} preserveAspectRatio="none" aria-hidden="true">{nodes.slice(1).map((node, index) => { const parent = parentFor(node, index + 1); return parent ? <line key={node.id} x1={parent.x} y1={parent.y} x2={node.x} y2={node.y} /> : null; })}</svg>
        {nodes.map((node, i) => {
          const metrics = mindNodeMetrics(node.text, i === 0);
          return <article key={node.id} className={`mind-node ${i === 0 ? "root" : ""} ${selectedNodeId === node.id ? "selected" : ""}`} style={{ left: `${((node.x - MINDMAP_WORLD.minX) / MINDMAP_WORLD.width) * 100}%`, top: `${((node.y - MINDMAP_WORLD.minY) / MINDMAP_WORLD.height) * 100}%`, width: metrics.width, minHeight: metrics.height, background: node.color, color: contrastingTextColor(node.color) }} onFocusCapture={() => setSelectedNodeId(node.id)} onPointerDown={(e) => { setSelectedNodeId(node.id); if (!["INPUT", "TEXTAREA", "BUTTON"].includes((e.target as HTMLElement).tagName)) { e.currentTarget.setPointerCapture(e.pointerId); setDragging(node.id); } }}>
            <textarea rows={metrics.lineCount} aria-label={`Nœud ${i + 1}`} value={node.text} onChange={(e) => onChange(nodes.map((n) => n.id === node.id ? { ...n, text: e.target.value } : n))} />
            <label aria-label="Couleur du nœud"><input type="color" value={node.color} onChange={(e) => onChange(nodes.map((n) => n.id === node.id ? { ...n, color: e.target.value } : n))} /></label>
            <button aria-label="Supprimer le nœud" onClick={() => deleteNode(node.id)}>×</button>
          </article>;
        })}
        {!nodes.length && <div className="map-empty"><span>⌘</span><strong>COMMENCE PAR LE SUJET CENTRAL</strong><button onClick={addNode}>CRÉER LA CARTE</button></div>}
      </div>
    </div>
  </Panel>;
}

function Empty({ text }: { text: string }) { return <div className="empty"><span>⌁</span><p>{text}</p></div>; }
