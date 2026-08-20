"use client";

import { useEffect, useMemo, useState } from "react";
import { topics, type Topic } from "../data/topics";

type Source = { id: string; title: string; url: string };
type Card = { id: string; front: string; back: string };
type Slide = { id: string; title: string; body: string; background?: string; color?: string; image?: string; layout?: "impact" | "canvas" };
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
type Screen = "home" | "roll" | "workspace" | "over" | "present";
type Tab = "notes" | "sources" | "cards" | "mindmap" | "slides";

const SESSION_KEY = "brainroll-session-v1";
const MODE_CONFIG = {
  classic: { label: "CLASSIQUE", durationSeconds: 60 * 60 },
  fast: { label: "FAST", durationSeconds: 30 * 60 },
} as const;
const uid = () => Math.random().toString(36).slice(2, 9);
const freshSlide = (n = 1): Slide => ({ id: uid(), title: n === 1 ? "Titre de la présentation" : `Slide ${n}`, body: n === 1 ? "Une phrase qui donne envie d’écouter la suite." : "Ajoute ton idée essentielle ici.", background: "#f2efe6", color: "#191815", layout: "impact" });
const formatTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

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
    return (
      <main className="presentation" style={{ "--topic-accent": session.topic.accent } as React.CSSProperties}>
        <div className="present-top"><span>⚄ BRAINROLL</span><span>{presentIndex + 1} / {session.slides.length}</span></div>
        <section className={`present-slide ${slide.layout === "canvas" ? "canvas-layout" : ""}`} style={{ background: slide.background ?? "#f2efe6", color: slide.color ?? "#191815" }}>
          {slide.image && <img src={slide.image} alt="Visuel de la slide" />}
          <div className="present-copy">
          <span className="slide-kicker">{session.topic.category} · {session.topic.title}</span>
          <h1>{slide.title}</h1>
          <p>{slide.body}</p>
          </div>
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
                    <div className="slide-list">{session.slides.map((slide, i) => <button className={i === slideIndex ? "active" : ""} key={slide.id} onClick={() => setSlideIndex(i)}><span>{String(i + 1).padStart(2, "0")}</span><b>{slide.title || "Sans titre"}</b></button>)}<button className="add-slide" onClick={addSlide}>+ ADD SLIDE</button></div>
                    <div className="slide-stage">
                      <div className="slide-customize">
                        <label>FOND <input type="color" value={session.slides[slideIndex]?.background ?? "#f2efe6"} onChange={(e) => updateSlide({ background: e.target.value })} /></label>
                        <label>TEXTE <input type="color" value={session.slides[slideIndex]?.color ?? "#191815"} onChange={(e) => updateSlide({ color: e.target.value })} /></label>
                        <button className={session.slides[slideIndex]?.layout !== "canvas" ? "active" : ""} onClick={() => updateSlide({ layout: "impact" })}>IMPACT</button>
                        <button className={session.slides[slideIndex]?.layout === "canvas" ? "active" : ""} onClick={() => updateSlide({ layout: "canvas" })}>CANVAS + IMAGE</button>
                        <label className="image-upload">+ IMAGE<input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && addImageToSlide(e.target.files[0])} /></label>
                      </div>
                      <div className={`mini-slide ${session.slides[slideIndex]?.layout === "canvas" ? "canvas-layout" : ""}`} style={{ background: session.slides[slideIndex]?.background, color: session.slides[slideIndex]?.color }}>
                        {session.slides[slideIndex]?.image && <div className="slide-image"><img src={session.slides[slideIndex].image} alt="Visuel ajouté" /><button aria-label="Retirer l’image" onClick={() => updateSlide({ image: undefined })}>×</button></div>}
                        <div className="slide-copy"><span>{session.topic.category}</span><input aria-label="Titre de la slide" value={session.slides[slideIndex]?.title ?? ""} onChange={(e) => updateSlide({ title: e.target.value })} /><textarea aria-label="Contenu de la slide" value={session.slides[slideIndex]?.body ?? ""} onChange={(e) => updateSlide({ body: e.target.value })} /></div><i>{String(slideIndex + 1).padStart(2, "0")}</i>
                      </div>
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
