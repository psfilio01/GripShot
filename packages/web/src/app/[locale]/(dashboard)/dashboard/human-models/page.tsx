"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Link } from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/components/toast";

interface HumanModelRow {
  id: string;
  displayName: string;
  notes: string;
  source?: "human" | "ai";
  thumbnailUrl?: string | null;
}

type Tab = "human" | "ai";

export default function HumanModelsPage() {
  const router = useRouter();
  const [models, setModels] = useState<HumanModelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("human");
  const { toast } = useToast();

  // Human model form
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);

  // AI model form
  const [aiName, setAiName] = useState("");
  const [aiFreetext, setAiFreetext] = useState("");
  const [aiGender, setAiGender] = useState("");
  const [aiAgeRange, setAiAgeRange] = useState("");
  const [aiBodyBuild, setAiBodyBuild] = useState("");
  const [aiEthnicity, setAiEthnicity] = useState("");
  const [aiHairColor, setAiHairColor] = useState("");
  const [aiHairLength, setAiHairLength] = useState("");
  const [aiSkinTone, setAiSkinTone] = useState("");
  const [aiHeight, setAiHeight] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);

  async function load() {
    const res = await fetch("/api/human-models");
    if (res.ok) {
      const data = await res.json();
      setModels(data.models ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/human-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name.trim(), notes: notes.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        toast("Model created — add reference photos next", "success");
        setName("");
        setNotes("");
        await load();
        router.push(`/dashboard/human-models/${data.modelId}`);
      } else {
        const err = await res.json().catch(() => null);
        toast(err?.error ?? "Create failed", "error");
      }
    } catch {
      toast("Create failed", "error");
    } finally {
      setCreating(false);
    }
  }

  async function handleAiGenerate(e: FormEvent) {
    e.preventDefault();
    if (!aiName.trim() || !aiFreetext.trim()) return;
    setAiGenerating(true);
    try {
      const res = await fetch("/api/human-models/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: aiName.trim(),
          freetext: aiFreetext.trim(),
          ...(aiGender && { gender: aiGender }),
          ...(aiAgeRange && { ageRange: aiAgeRange }),
          ...(aiBodyBuild && { bodyBuild: aiBodyBuild }),
          ...(aiEthnicity && { ethnicity: aiEthnicity }),
          ...(aiHairColor && { hairColor: aiHairColor }),
          ...(aiHairLength && { hairLength: aiHairLength }),
          ...(aiSkinTone && { skinTone: aiSkinTone }),
          ...(aiHeight && { height: aiHeight }),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast("AI model generated successfully", "success");
        setAiName("");
        setAiFreetext("");
        setAiGender("");
        setAiAgeRange("");
        setAiBodyBuild("");
        setAiEthnicity("");
        setAiHairColor("");
        setAiHairLength("");
        setAiSkinTone("");
        setAiHeight("");
        await load();
        router.push(`/dashboard/human-models/${data.modelId}`);
      } else {
        const err = await res.json().catch(() => null);
        toast(err?.error ?? "Generation failed", "error");
      }
    } catch {
      toast("Generation failed", "error");
    } finally {
      setAiGenerating(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-8 gs-fade-in">
      <div>
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ color: "var(--gs-text)" }}
        >
          Models
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--gs-text-muted)" }}>
          Create human models from reference photos or generate AI models from a
          text description. Models are used for lifestyle shots.
        </p>
      </div>

      {/* Tab switcher */}
      <div
        className="flex gap-1 rounded-lg p-1"
        style={{ background: "var(--gs-surface-inset)" }}
      >
        <button
          onClick={() => setTab("human")}
          className="flex-1 rounded-md px-4 py-2 text-sm font-medium transition"
          style={{
            background: tab === "human" ? "var(--gs-surface)" : "transparent",
            color:
              tab === "human"
                ? "var(--gs-text)"
                : "var(--gs-text-muted)",
            boxShadow: tab === "human" ? "var(--gs-shadow-sm)" : "none",
          }}
        >
          Human model
        </button>
        <button
          onClick={() => setTab("ai")}
          className="flex-1 rounded-md px-4 py-2 text-sm font-medium transition"
          style={{
            background: tab === "ai" ? "var(--gs-surface)" : "transparent",
            color:
              tab === "ai" ? "var(--gs-text)" : "var(--gs-text-muted)",
            boxShadow: tab === "ai" ? "var(--gs-shadow-sm)" : "none",
          }}
        >
          AI model
        </button>
      </div>

      {/* Human model form */}
      {tab === "human" && (
        <form onSubmit={handleCreate} className="gs-card-static p-6 space-y-4">
          <h2
            className="text-sm font-semibold"
            style={{ color: "var(--gs-text-secondary)" }}
          >
            New human model
          </h2>
          <p className="text-xs" style={{ color: "var(--gs-text-faint)" }}>
            Upload reference photos for each talent. Generated lifestyle shots
            will match the chosen model.
          </p>
          <div>
            <label
              htmlFor="human-model-new-name"
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--gs-text-secondary)" }}
            >
              Display name
            </label>
            <input
              id="human-model-new-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Studio model A"
              className="gs-input block w-full px-3 py-2 text-sm"
              maxLength={120}
            />
          </div>
          <div>
            <label
              htmlFor="human-model-new-notes"
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--gs-text-secondary)" }}
            >
              Notes (optional)
            </label>
            <input
              id="human-model-new-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Hair, build, usage rights reminder…"
              className="gs-input block w-full px-3 py-2 text-sm"
              maxLength={500}
            />
          </div>
          <button
            type="submit"
            disabled={creating || !name.trim()}
            className="gs-btn-primary px-4 py-2 text-sm"
          >
            {creating ? "Creating…" : "Create & upload references"}
          </button>
        </form>
      )}

      {/* AI model form */}
      {tab === "ai" && (
        <form
          onSubmit={handleAiGenerate}
          className="gs-card-static p-6 space-y-4"
        >
          <h2
            className="text-sm font-semibold"
            style={{ color: "var(--gs-text-secondary)" }}
          >
            Generate AI model
          </h2>
          <p className="text-xs" style={{ color: "var(--gs-text-faint)" }}>
            Describe the model and Gemini will generate a reference portrait.
            Unless you specify otherwise, the model will wear a plain black
            bikini against a neutral studio backdrop.
          </p>

          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--gs-text-secondary)" }}
            >
              Model name
            </label>
            <input
              type="text"
              value={aiName}
              onChange={(e) => setAiName(e.target.value)}
              placeholder="e.g. AI Model – Sporty Look"
              className="gs-input block w-full px-3 py-2 text-sm"
              maxLength={120}
            />
          </div>

          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--gs-text-secondary)" }}
            >
              Description (freetext)
            </label>
            <textarea
              value={aiFreetext}
              onChange={(e) => setAiFreetext(e.target.value)}
              placeholder="Describe the model's appearance, style, and any specific details…"
              className="gs-input block w-full px-3 py-2 text-sm min-h-[80px]"
              maxLength={2000}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={{ color: "var(--gs-text-muted)" }}
              >
                Gender
              </label>
              <select
                value={aiGender}
                onChange={(e) => setAiGender(e.target.value)}
                className="gs-input block w-full px-2 py-1.5 text-sm"
              >
                <option value="">Any</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="non-binary">Non-binary</option>
              </select>
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={{ color: "var(--gs-text-muted)" }}
              >
                Age range
              </label>
              <select
                value={aiAgeRange}
                onChange={(e) => setAiAgeRange(e.target.value)}
                className="gs-input block w-full px-2 py-1.5 text-sm"
              >
                <option value="">Any</option>
                <option value="18-25">18–25</option>
                <option value="25-35">25–35</option>
                <option value="35-45">35–45</option>
                <option value="45-55">45–55</option>
                <option value="55+">55+</option>
              </select>
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={{ color: "var(--gs-text-muted)" }}
              >
                Body build
              </label>
              <select
                value={aiBodyBuild}
                onChange={(e) => setAiBodyBuild(e.target.value)}
                className="gs-input block w-full px-2 py-1.5 text-sm"
              >
                <option value="">Any</option>
                <option value="slim">Slim</option>
                <option value="athletic">Athletic</option>
                <option value="average">Average</option>
                <option value="curvy">Curvy</option>
                <option value="plus-size">Plus-size</option>
                <option value="muscular">Muscular</option>
              </select>
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={{ color: "var(--gs-text-muted)" }}
              >
                Ethnicity
              </label>
              <input
                type="text"
                value={aiEthnicity}
                onChange={(e) => setAiEthnicity(e.target.value)}
                placeholder="e.g. East Asian"
                className="gs-input block w-full px-2 py-1.5 text-sm"
                maxLength={100}
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={{ color: "var(--gs-text-muted)" }}
              >
                Hair color
              </label>
              <input
                type="text"
                value={aiHairColor}
                onChange={(e) => setAiHairColor(e.target.value)}
                placeholder="e.g. dark brown"
                className="gs-input block w-full px-2 py-1.5 text-sm"
                maxLength={50}
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={{ color: "var(--gs-text-muted)" }}
              >
                Hair length
              </label>
              <select
                value={aiHairLength}
                onChange={(e) => setAiHairLength(e.target.value)}
                className="gs-input block w-full px-2 py-1.5 text-sm"
              >
                <option value="">Any</option>
                <option value="short">Short</option>
                <option value="medium">Medium</option>
                <option value="long">Long</option>
                <option value="very long">Very long</option>
                <option value="shaved">Shaved</option>
              </select>
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={{ color: "var(--gs-text-muted)" }}
              >
                Skin tone
              </label>
              <input
                type="text"
                value={aiSkinTone}
                onChange={(e) => setAiSkinTone(e.target.value)}
                placeholder="e.g. olive"
                className="gs-input block w-full px-2 py-1.5 text-sm"
                maxLength={50}
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={{ color: "var(--gs-text-muted)" }}
              >
                Height
              </label>
              <select
                value={aiHeight}
                onChange={(e) => setAiHeight(e.target.value)}
                className="gs-input block w-full px-2 py-1.5 text-sm"
              >
                <option value="">Any</option>
                <option value="petite (under 160cm)">Petite</option>
                <option value="average (160-170cm)">Average</option>
                <option value="tall (170-180cm)">Tall</option>
                <option value="very tall (over 180cm)">Very tall</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={aiGenerating || !aiName.trim() || !aiFreetext.trim()}
            className="gs-btn-primary px-4 py-2 text-sm"
          >
            {aiGenerating ? "Generating with Gemini…" : "Generate AI model"}
          </button>
          {aiGenerating && (
            <p
              className="text-xs"
              style={{ color: "var(--gs-text-faint)" }}
            >
              This may take 30–60 seconds…
            </p>
          )}
        </form>
      )}

      {/* Models list */}
      {loading ? (
        <p className="text-sm" style={{ color: "var(--gs-text-faint)" }}>
          Loading…
        </p>
      ) : models.length === 0 ? (
        <EmptyState
          icon="👤"
          title="No models yet"
          description="Create a model and add 1–3 clear reference photos (face + body) for best lifestyle results."
        />
      ) : (
        <ul className="space-y-2">
          {models.map((m) => (
            <li key={m.id}>
              <Link
                href={`/dashboard/human-models/${encodeURIComponent(m.id)}`}
                className="gs-card-static flex items-center gap-4 p-4 transition hover:opacity-95"
                style={{ borderColor: "var(--gs-border)" }}
              >
                {/* Thumbnail */}
                <div
                  className="h-12 w-12 shrink-0 rounded-lg overflow-hidden flex items-center justify-center"
                  style={{
                    background: "var(--gs-surface-inset)",
                    border: "1px solid var(--gs-border-subtle)",
                  }}
                >
                  {m.thumbnailUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={m.thumbnailUrl}
                      alt={m.displayName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span
                      className="text-lg"
                      style={{ color: "var(--gs-text-faint)" }}
                    >
                      👤
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p
                      className="font-semibold text-sm truncate"
                      style={{ color: "var(--gs-text)" }}
                    >
                      {m.displayName}
                    </p>
                    {(m.source === "ai") && (
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{
                          background: "var(--gs-accent-bg)",
                          color: "var(--gs-accent-text)",
                        }}
                      >
                        AI
                      </span>
                    )}
                  </div>
                  {m.notes ? (
                    <p
                      className="text-xs mt-0.5 line-clamp-1"
                      style={{ color: "var(--gs-text-muted)" }}
                    >
                      {m.notes}
                    </p>
                  ) : null}
                </div>

                <span
                  className="shrink-0 text-xs font-medium"
                  style={{ color: "var(--gs-accent-text)" }}
                >
                  Manage →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
