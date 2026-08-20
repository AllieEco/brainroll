"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { topics, type Topic } from "../data/topics";

type Source = { id: string; title: string; url: string };
type Card = { id: string; front: string; back: string };
type SlideBlock = "title" | "body" | "image";
type BlockPosition = { x: number; y: number; width: number };
type Slide = { id: string; title: string; body: string; background?: string; color?: string; image?: string; layout?: "impact" | "canvas"; positions?: Partial<Record<SlideBlock, BlockPosition>> };
type MindNode = { id: string; text: string; x: number; y: number; color: string };
type GameMode = "classic" | "fast";
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
const TOPICS_PER_PAGE = 50;
const TOPIC_THEMES = Array.from(new Set(topics.map((entry) => entry.category))).sort((a, b) => a.localeCompare(b, "fr"));
const MODE_CONFIG = {
  classic: { label: "CLASSIQUE", durationSeconds: 60 * 60 },
  fast: { label: "FAST", durationSeconds: 30 * 60 },
} as const;
const uid = () => Math.random().toString(36).slice(2, 9);
const freshSlide = (n = 1): Slide => ({ id: uid(), title: n === 1 ? "Titre de la présentation" : `Slide ${n}`, body: n === 1 ? "Une phrase qui donne envie d’écouter la suite." : "Ajoute ton idée essentielle ici.", background: "#f2efe6", color: "#191815", layout: "impact" });
const formatTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
const BLOCK_PRESETS: Record<"impact" | "canvas", Record<SlideBlock, BlockPosition>> = {
  impact: { title: { x: 8, y: 25, width: 78 }, body: { x: 8, y: 58, width: 62 }, image: { x: 63, y: 18, width: 30 } },
  canvas: { title: { x: 7, y: 23, width: 50 }, body: { x: 7, y: 58, width: 48 }, image: { x: 62, y: 18, width: 31 } },
};
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

  const progress = useMemo(() => session ? Math.max(0, Math.min(100, (secondsLeft / session.durationSeconds) * 100)) : 100, [secondsLeft, session]);
  const filteredTopics = useMemo(() => {
    return topics.filter((entry) => selectedThemes.includes(entry.category) && (topicDifficulty === "all" || entry.difficulty === topicDifficulty));
  }, [selectedThemes, topicDifficulty]);
  const topicPageCount = Math.max(1, Math.ceil(filteredTopics.length / TOPICS_PER_PAGE));
  const visibleTopics = filteredTopics.slice(topicPage * TOPICS_PER_PAGE, (topicPage + 1) * TOPICS_PER_PAGE);

  function roll(mode = selectedMode) {
    if (rolling) return;
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
    setScreen("roll");
    window.setTimeout(() => roll(mode), 80);
  }

  function startSession() {
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
    const reader = new FileReader();
    reader.onload = () => updateSlide({ image: String(reader.result), layout: "canvas" });
    reader.readAsDataURL(file);
  }

  if (screen === "present" && session) {
    const slide = session.slides[presentIndex] ?? session.slides[0];
    const preset = BLOCK_PRESETS[slide.layout ?? "impact"];
    return (
      <main className="presentation" style={{ "--topic-accent": session.topic.accent } as React.CSSProperties}>
        <div className="present-top"><span>⚄ BRAINROLL</span><span>{presentIndex + 1} / {session.slides.length}</span></div>
        <section className="present-slide freeform-slide" style={{ background: slide.background ?? "#f2efe6", color: slide.color ?? "#191815" }}>
          <span className="slide-kicker">{session.topic.category} · {session.topic.title}</span>
          <div className="present-block present-title" style={blockStyle(slide.positions?.title ?? preset.title)} dangerouslySetInnerHTML={{ __html: sanitizeRichText(slide.title) }} />
          <div className="present-block present-body" style={blockStyle(slide.positions?.body ?? preset.body)} dangerouslySetInnerHTML={{ __html: sanitizeRichText(slide.body) }} />
          {slide.image && <div className="present-block present-image" style={blockStyle(slide.positions?.image ?? preset.image)}><img src={slide.image} alt="Visuel de la slide" /></div>}
        </section>
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
          <div className={`timer ${secondsLeft <= 300 ? "urgent" : ""}`}><span className="timer-dot" /> {formatTime(secondsLeft)}</div>
        ) : <div className="topbar-actions"><button className={`topics-tab ${screen === "topics" ? "active" : ""}`} onClick={() => setScreen(screen === "topics" ? "home" : "topics")}>{screen === "topics" ? "FERMER LA LISTE" : "VOIR LA LISTE DES SUJETS"}</button><div className="top-meta"><span className={session ? "live-dot active" : "live-dot"} /> {session ? "SESSION SAVED" : "NO SESSION RUNNING"}</div></div>}
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
          <div className="roll-actions"><button className="secondary" onClick={() => roll()} disabled={rolling}>↻ REROLL</button><button className="primary" onClick={startSession} disabled={rolling}>GO <span>→</span></button></div>
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
              <div className="aside-label">WORKSPACE</div>
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
                  <div className="cards-grid">{session.cards.length ? session.cards.map((card, i) => <article className="flashcard" key={card.id}><small>CARD {String(i + 1).padStart(2, "0")}</small><strong>{card.front}</strong><p>{card.back || "Réponse à compléter…"}</p><button onClick={() => updateSession({ cards: session.cards.filter((c) => c.id !== card.id) })}>SUPPRIMER</button></article>) : <Empty text="Transforme les idées importantes en questions." />}</div>
                </Panel>
              )}
              {tab === "mindmap" && <MindMapPanel session={session} onChange={(mindMap) => updateSession({ mindMap })} onAddToSlide={(image) => { const next = [...session.slides, { ...freshSlide(session.slides.length + 1), title: "Carte mentale", body: "", image, layout: "canvas" as const }]; updateSession({ slides: next }); setSlideIndex(next.length - 1); setTab("slides"); }} />}
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
                        <label className="image-upload">+ IMAGE<input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && addImageToSlide(e.target.files[0])} /></label>
                      </div>
                      <p className="slide-editor-hint">Sélectionne du texte pour le formater · Attrape les poignées pour déplacer les blocs</p>
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
      {confirmAbandon && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="abandon-title"><div className="confirm-modal"><span>⚠ DANGER ZONE</span><h2 id="abandon-title">Abandonner la partie ?</h2><p>Le chrono s’arrêtera et toutes les notes, sources, cartes et slides de cette session seront supprimées.</p><div><button className="secondary" onClick={() => setConfirmAbandon(false)}>CONTINUER LA PARTIE</button><button className="danger" onClick={abandonSession}>OUI, ABANDONNER</button></div></div></div>}
    </main>
  );
}

function blockStyle(position: BlockPosition): React.CSSProperties {
  return { left: `${position.x}%`, top: `${position.y}%`, width: `${position.width}%` };
}

function SlideCanvas({ slide, topic, index, onChange }: { slide: Slide; topic: Topic; index: number; onChange: (patch: Partial<Slide>) => void }) {
  const boardRef = useRef<HTMLDivElement>(null);
  const preset = BLOCK_PRESETS[slide.layout ?? "impact"];
  const [drag, setDrag] = useState<{ block: SlideBlock; startX: number; startY: number; origin: BlockPosition } | null>(null);
  const positionFor = (block: SlideBlock) => slide.positions?.[block] ?? preset[block];

  function startDrag(event: React.PointerEvent<HTMLButtonElement>, block: SlideBlock) {
    if (!boardRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ block, startX: event.clientX, startY: event.clientY, origin: positionFor(block) });
  }

  function moveDrag(event: React.PointerEvent<HTMLButtonElement>) {
    if (!drag || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100 - drag.origin.width, drag.origin.x + ((event.clientX - drag.startX) / rect.width) * 100));
    const y = Math.max(0, Math.min(88, drag.origin.y + ((event.clientY - drag.startY) / rect.height) * 100));
    onChange({ positions: { ...slide.positions, [drag.block]: { ...drag.origin, x, y } } });
  }

  const handle = (block: SlideBlock, label: string) => (
    <button className="block-handle" aria-label={`Déplacer ${label}`} title={`Déplacer ${label}`} onPointerDown={(event) => startDrag(event, block)} onPointerMove={moveDrag} onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)}>⠿</button>
  );

  return (
    <div ref={boardRef} className="mini-slide freeform-editor" style={{ background: slide.background, color: slide.color }}>
      <span className="slide-kicker editor-kicker">{topic.category}</span>
      <div className="editable-block title-block" style={blockStyle(positionFor("title"))}>
        {handle("title", "le titre")}
        <RichTextEditor className="slide-title-editor" label="Titre de la slide" value={slide.title} onChange={(title) => onChange({ title })} />
      </div>
      <div className="editable-block body-block" style={blockStyle(positionFor("body"))}>
        {handle("body", "le texte")}
        <RichTextEditor className="slide-body-editor" label="Contenu de la slide" value={slide.body} onChange={(body) => onChange({ body })} />
      </div>
      {slide.image && (
        <div className="editable-block image-block" style={blockStyle(positionFor("image"))}>
          {handle("image", "l’image")}
          <img src={slide.image} alt="Visuel ajouté" />
          <button className="remove-slide-image" aria-label="Retirer l’image" onClick={() => onChange({ image: undefined })}>×</button>
        </div>
      )}

      <i>{String(index + 1).padStart(2, "0")}</i>
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

function MindMapPanel({ session, onChange, onAddToSlide }: { session: Session; onChange: (nodes: MindNode[]) => void; onAddToSlide: (image: string) => void }) {
  const nodes = session.mindMap ?? [];
  const [dragging, setDragging] = useState<string | null>(null);

  function addNode() {
    const index = nodes.length;
    const angle = Math.max(0, index - 1) * 1.65;
    const node: MindNode = index === 0
      ? { id: uid(), text: session.topic.title, x: 450, y: 260, color: session.topic.accent }
      : { id: uid(), text: "Nouvelle idée", x: 450 + Math.cos(angle) * 270, y: 260 + Math.sin(angle) * 175, color: ["#dfff43", "#55b9ff", "#ff8ec7", "#ffca45"][index % 4] };
    onChange([...nodes, node]);
  }

  function moveNode(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(70, Math.min(830, ((event.clientX - rect.left) / rect.width) * 900));
    const y = Math.max(45, Math.min(475, ((event.clientY - rect.top) / rect.height) * 520));
    onChange(nodes.map((node) => node.id === dragging ? { ...node, x, y } : node));
  }

  function renderMap() {
    const canvas = document.createElement("canvas");
    canvas.width = 1600; canvas.height = 900;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.fillStyle = "#f2efe6"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(25,24,21,.15)"; ctx.lineWidth = 1;
    for (let x = 0; x < 1600; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 900); ctx.stroke(); }
    for (let y = 0; y < 900; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1600, y); ctx.stroke(); }
    const root = nodes[0];
    if (root) nodes.slice(1).forEach((node) => { ctx.beginPath(); ctx.strokeStyle = "#191815"; ctx.lineWidth = 5; ctx.moveTo(root.x * 16 / 9, root.y * 45 / 26); ctx.lineTo(node.x * 16 / 9, node.y * 45 / 26); ctx.stroke(); });
    nodes.forEach((node) => {
      const x = node.x * 16 / 9, y = node.y * 45 / 26, width = node.id === root?.id ? 330 : 250, height = node.id === root?.id ? 115 : 90;
      ctx.fillStyle = node.color; ctx.strokeStyle = "#191815"; ctx.lineWidth = 6;
      ctx.fillRect(x - width / 2, y - height / 2, width, height); ctx.strokeRect(x - width / 2, y - height / 2, width, height);
      ctx.fillStyle = "#191815"; ctx.font = `900 ${node.id === root?.id ? 28 : 22}px Arial`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const words = node.text.split(" "); let line = ""; const lines: string[] = [];
      words.forEach((word) => { const test = `${line} ${word}`.trim(); if (ctx.measureText(test).width > width - 28 && line) { lines.push(line); line = word; } else line = test; }); lines.push(line);
      lines.slice(0, 3).forEach((text, i) => ctx.fillText(text, x, y + (i - (lines.length - 1) / 2) * 26));
    });
    return canvas.toDataURL("image/png");
  }

  function downloadMap() {
    const image = renderMap(); if (!image) return;
    const link = document.createElement("a"); link.href = image; link.download = `brainroll-carte-mentale.png`; link.click();
  }

  return <Panel title="Carte mentale" eyebrow="CONNECT THE DOTS" count={`${nodes.length} NODES`}>
    <div className="map-toolbar"><button onClick={addNode}>+ AJOUTER UN NŒUD</button><span>Glisse les cartes pour organiser tes idées.</span><button onClick={downloadMap} disabled={!nodes.length}>↓ PNG</button><button onClick={() => { const image = renderMap(); if (image) onAddToSlide(image); }} disabled={!nodes.length}>+ AJOUTER AUX SLIDES</button></div>
    <div className="mindmap-board" onPointerMove={moveNode} onPointerUp={() => setDragging(null)} onPointerLeave={() => setDragging(null)}>
      <svg viewBox="0 0 900 520" preserveAspectRatio="none" aria-hidden="true">{nodes[0] && nodes.slice(1).map((node) => <line key={node.id} x1={nodes[0].x} y1={nodes[0].y} x2={node.x} y2={node.y} />)}</svg>
      {nodes.map((node, i) => <article key={node.id} className={`mind-node ${i === 0 ? "root" : ""}`} style={{ left: `${node.x / 9}%`, top: `${node.y / 5.2}%`, background: node.color }} onPointerDown={(e) => { if ((e.target as HTMLElement).tagName !== "INPUT" && (e.target as HTMLElement).tagName !== "BUTTON") { e.currentTarget.setPointerCapture(e.pointerId); setDragging(node.id); } }}>
        <input aria-label={`Nœud ${i + 1}`} value={node.text} onChange={(e) => onChange(nodes.map((n) => n.id === node.id ? { ...n, text: e.target.value } : n))} />
        <label aria-label="Couleur du nœud"><input type="color" value={node.color} onChange={(e) => onChange(nodes.map((n) => n.id === node.id ? { ...n, color: e.target.value } : n))} /></label>
        <button aria-label="Supprimer le nœud" onClick={() => onChange(nodes.filter((n) => n.id !== node.id))}>×</button>
      </article>)}
      {!nodes.length && <div className="map-empty"><span>⌘</span><strong>COMMENCE PAR LE SUJET CENTRAL</strong><button onClick={addNode}>CRÉER LA CARTE</button></div>}
    </div>
  </Panel>;
}

function Empty({ text }: { text: string }) { return <div className="empty"><span>⌁</span><p>{text}</p></div>; }
