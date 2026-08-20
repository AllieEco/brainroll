"use client";

import { useEffect, useMemo, useState } from "react";

type Topic = { category: string; title: string; difficulty: number; constraint: string; accent: string };
type Source = { id: string; title: string; url: string };
type Card = { id: string; front: string; back: string };
type Slide = { id: string; title: string; body: string };
type Session = {
  topic: Topic;
  endsAt: number;
  notes: string;
  sources: Source[];
  cards: Card[];
  slides: Slide[];
  locked: boolean;
};
type Screen = "home" | "roll" | "workspace" | "over" | "present";
type Tab = "notes" | "sources" | "cards" | "slides";

const SESSION_KEY = "brainroll-session-v1";
const topics: Topic[] = [
  { category: "HISTOIRE", title: "La révolte des Taiping", difficulty: 4, constraint: "Ta présentation doit contenir une carte.", accent: "#ff5b35" },
  { category: "SCIENCES", title: "Les lichens", difficulty: 3, constraint: "Explique le sujet sans utiliser de jargon.", accent: "#55b9ff" },
  { category: "ART", title: "Artemisia Gentileschi", difficulty: 3, constraint: "Intègre une source primaire.", accent: "#ff8ec7" },
  { category: "GÉOGRAPHIE", title: "Ouagadougou", difficulty: 2, constraint: "Une slide doit être une carte commentée.", accent: "#dfff43" },
  { category: "HISTOIRE", title: "Les égouts de Londres au XIXe siècle", difficulty: 4, constraint: "Ajoute une chronologie de cinq dates maximum.", accent: "#ffca45" },
  { category: "CULTURES", title: "Le théâtre nō", difficulty: 4, constraint: "Maximum 8 slides.", accent: "#c19cff" },
  { category: "HISTOIRE", title: "La République de Weimar", difficulty: 4, constraint: "Explique une controverse autour du sujet.", accent: "#ff5b35" },
  { category: "SCIENCES", title: "Les tardigrades", difficulty: 2, constraint: "Une slide doit contenir un meme exact.", accent: "#55b9ff" },
  { category: "TECHNOLOGIE", title: "L’histoire du téflon", difficulty: 3, constraint: "Aucun texte de plus de 25 mots par slide.", accent: "#dfff43" },
  { category: "CIVILISATIONS", title: "Le royaume d’Aksoum", difficulty: 4, constraint: "Compare deux interprétations historiques.", accent: "#c19cff" },
];

const uid = () => Math.random().toString(36).slice(2, 9);
const freshSlide = (n = 1): Slide => ({ id: uid(), title: n === 1 ? "Titre de la présentation" : `Slide ${n}`, body: n === 1 ? "Une phrase qui donne envie d’écouter la suite." : "Ajoute ton idée essentielle ici." });
const formatTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [topic, setTopic] = useState(topics[0]);
  const [rolling, setRolling] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [tab, setTab] = useState<Tab>("notes");
  const [secondsLeft, setSecondsLeft] = useState(3600);
  const [sourceDraft, setSourceDraft] = useState({ title: "", url: "" });
  const [cardDraft, setCardDraft] = useState({ front: "", back: "" });
  const [slideIndex, setSlideIndex] = useState(0);
  const [presentIndex, setPresentIndex] = useState(0);

  useEffect(() => {
    const saved = window.localStorage.getItem(SESSION_KEY);
    if (!saved) return;
    try {
      const restored = JSON.parse(saved) as Session;
      const locked = restored.locked || Date.now() >= restored.endsAt;
      const next = { ...restored, locked };
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

  const progress = useMemo(() => session ? Math.max(0, Math.min(100, (secondsLeft / 3600) * 100)) : 100, [secondsLeft, session]);

  function roll() {
    if (rolling) return;
    setRolling(true);
    let ticks = 0;
    const shuffle = window.setInterval(() => {
      setTopic(topics[Math.floor(Math.random() * topics.length)]);
      ticks++;
      if (ticks >= 8) { window.clearInterval(shuffle); setRolling(false); }
    }, 90);
  }

  function startSession() {
    const next: Session = { topic, endsAt: Date.now() + 60 * 60 * 1000, notes: "", sources: [], cards: [], slides: [freshSlide()], locked: false };
    setSession(next);
    setSecondsLeft(3600);
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

  if (screen === "present" && session) {
    const slide = session.slides[presentIndex] ?? session.slides[0];
    return (
      <main className="presentation" style={{ "--topic-accent": session.topic.accent } as React.CSSProperties}>
        <div className="present-top"><span>⚄ BRAINROLL</span><span>{presentIndex + 1} / {session.slides.length}</span></div>
        <section className="present-slide">
          <span className="slide-kicker">{session.topic.category} · {session.topic.title}</span>
          <h1>{slide.title}</h1>
          <p>{slide.body}</p>
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
        ) : <div className="top-meta"><span className={session ? "live-dot active" : "live-dot"} /> {session ? "SESSION SAVED" : "NO SESSION RUNNING"}</div>}
      </nav>

      {screen === "home" && (
        <section className="hero">
          <div className="eyebrow">A KNOWLEDGE SPEEDRUN</div>
          <h1>ROLL THE DICE.<br /><em>FEED YOUR BRAIN.</em></h1>
          <p className="lede">Un sujet. Une heure. Une présentation.<br />Jusqu&apos;où peut aller ta curiosité avant la fin du chrono ?</p>
          {session && !session.locked ? (
            <div className="resume-box"><span>PARTIE EN COURS · {session.topic.title}</span><button className="primary" onClick={() => setScreen("workspace")}>REPRENDRE · {formatTime(secondsLeft)} <span>→</span></button></div>
          ) : <button className="primary" onClick={() => { setScreen("roll"); window.setTimeout(roll, 80); }}>LET&apos;S ROLL <span>→</span></button>}
          <div className="loop" aria-label="Les cinq étapes du jeu">{["ROLL", "RESEARCH", "UNDERSTAND", "BUILD", "PRESENT"].map((step, i) => <span key={step}>{i > 0 && <b>→</b>}{step}</span>)}</div>
        </section>
      )}

      {screen === "roll" && (
        <section className="roll-screen">
          <div className="eyebrow">YOUR NEXT OBSESSION</div>
          <div className={`dice ${rolling ? "is-rolling" : ""}`} aria-hidden="true">⚄</div>
          <article className="topic-card" style={{ borderTopColor: topic.accent }}>
            <span className="category">{rolling ? "SEARCHING..." : topic.category}</span>
            <h2>{rolling ? "????????" : topic.title}</h2>
            <div className="difficulty"><span>DIFFICULTY</span> {"★".repeat(topic.difficulty)}{"☆".repeat(5 - topic.difficulty)}</div>
            <div className="constraint"><small>CHAOS CONSTRAINT</small><strong>{topic.constraint}</strong></div>
          </article>
          <div className="roll-actions"><button className="secondary" onClick={roll} disabled={rolling}>↻ REROLL</button><button className="primary" onClick={startSession} disabled={rolling}>GO <span>→</span></button></div>
          <p className="go-warning">Le chrono de 60 minutes démarre au clic.</p>
        </section>
      )}

      {screen === "workspace" && session && (
        <section className="workspace">
          <header className="challenge-strip">
            <div><span>{session.topic.category}</span><strong>{session.topic.title}</strong></div>
            <div className="constraint-mini"><span>CONTRAINTE</span><strong>{session.topic.constraint}</strong></div>
            <div className="autosave">✓ SAUVEGARDÉ</div>
          </header>
          <div className="time-progress"><i style={{ width: `${progress}%` }} /></div>
          <div className="work-layout">
            <aside>
              <div className="aside-label">WORKSPACE</div>
              {([['notes','✎','NOTES'],['sources','⌕','SOURCES'],['cards','▱','FLASHCARDS'],['slides','▣','SLIDES']] as const).map(([id, icon, label]) => (
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
              {tab === "slides" && (
                <Panel title="Slides" eyebrow="BUILD THE STORY" count={`${session.slides.length} SLIDES`}>
                  <div className="slides-editor">
                    <div className="slide-list">{session.slides.map((slide, i) => <button className={i === slideIndex ? "active" : ""} key={slide.id} onClick={() => setSlideIndex(i)}><span>{String(i + 1).padStart(2, "0")}</span><b>{slide.title || "Sans titre"}</b></button>)}<button className="add-slide" onClick={addSlide}>+ ADD SLIDE</button></div>
                    <div className="slide-stage"><div className="mini-slide"><span>{session.topic.category}</span><input aria-label="Titre de la slide" value={session.slides[slideIndex]?.title ?? ""} onChange={(e) => updateSlide({ title: e.target.value })} /><textarea aria-label="Contenu de la slide" value={session.slides[slideIndex]?.body ?? ""} onChange={(e) => updateSlide({ body: e.target.value })} /><i>{String(slideIndex + 1).padStart(2, "0")}</i></div><div className="slide-tools"><button onClick={deleteSlide} disabled={session.slides.length === 1}>SUPPRIMER</button><button onClick={() => { setPresentIndex(0); setScreen("present"); }}>PRÉSENTER ↗</button></div></div>
                  </div>
                </Panel>
              )}
            </div>
          </div>
        </section>
      )}
      {screen !== "workspace" && <footer><span>LESS BRAINROT. MORE BRAIN.</span><span>60:00 · CLASSIC MODE</span></footer>}
    </main>
  );
}

function Panel({ title, eyebrow, count, children }: { title: string; eyebrow: string; count: string; children: React.ReactNode }) {
  return <section className="panel-inner"><header><div><small>{eyebrow}</small><h2>{title}</h2></div><span>{count}</span></header>{children}</section>;
}

function NotesPanel({ session, onChange }: { session: Session; onChange: (value: string) => void }) {
  const words = session.notes.trim() ? session.notes.trim().split(/\s+/).length : 0;
  return <Panel title="Notes" eyebrow="CAPTURE THE CHAOS" count={`${words} WORDS`}><div className="note-toolbar"><button onClick={() => onChange(session.notes + "\n# ")}>H1</button><button onClick={() => onChange(session.notes + "\n## ")}>H2</button><button onClick={() => onChange(session.notes + "**texte**")}>B</button><button onClick={() => onChange(session.notes + "\n• ")}>• LIST</button><span>AUTOSAVE ON</span></div><textarea className="notes-area" aria-label="Notes de recherche" placeholder={'Commence à creuser…\n\nNote les idées essentielles, les dates, les noms et les questions qui apparaissent.'} value={session.notes} onChange={(e) => onChange(e.target.value)} /></Panel>;
}

function Empty({ text }: { text: string }) { return <div className="empty"><span>⌁</span><p>{text}</p></div>; }
