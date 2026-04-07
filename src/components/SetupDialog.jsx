import {
  C,
  btnStyle,
  inputStyle,
} from "../constants";

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.1em",
          color: C.muted,
          textTransform: "uppercase",
          marginBottom: 10,
          paddingBottom: 6,
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Label({ children, style }) {
  return <div style={{ fontSize: 12, color: C.muted, marginBottom: 5, ...style }}>{children}</div>;
}

function Hint({ children }) {
  return <span style={{ color: C.faint, fontSize: 11 }}> {children}</span>;
}

export default function SetupDialog({
  scrapeCreatorsApiKey,
  setScrapeCreatorsApiKey,
  competitors,
  setCompetitors,
  metaCountryMode,
  setMetaCountryMode,
  metaCountriesInput,
  setMetaCountriesInput,
  googleRegionMode,
  setGoogleRegionMode,
  googleRegionsInput,
  setGoogleRegionsInput,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  onClose,
}) {
  const addCompetitor = () =>
    setCompetitors((current) => [...current, { id: Date.now(), name: "", website: "", searchTerm: "" }]);

  const removeCompetitor = (id) =>
    setCompetitors((current) => current.filter((competitor) => competitor.id !== id));

  const updateCompetitor = (id, field, value) =>
    setCompetitors((current) =>
      current.map((competitor) => (
        competitor.id === id ? { ...competitor, [field]: value } : competitor
      )),
    );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          padding: "28px 32px",
          width: "min(900px, 95vw)",
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ color: C.text, fontSize: 18, fontWeight: 600 }}>Configuration</h2>
          <button onClick={onClose} style={btnStyle("ghost")}>✕ Close</button>
        </div>

        <Section title="API Key">
          <Label>ScrapeCreators API Key <Hint>(used for native Google and Meta ad lookups)</Hint></Label>
          <input
            style={inputStyle}
            type="password"
            placeholder="sc_..."
            value={scrapeCreatorsApiKey}
            onChange={(event) => setScrapeCreatorsApiKey(event.target.value)}
          />
        </Section>

        <Section title="Date Comparison">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <Label>Start Date</Label>
              <input
                style={inputStyle}
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div>
              <Label>End Date</Label>
              <input
                style={inputStyle}
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
            Each table column is scanned as a point-in-time snapshot using the same date for both `start_date` and `end_date`.
          </div>
        </Section>

        <Section title="Meta Countries">
          <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 12, alignItems: "start" }}>
            <div>
              <Label>Mode</Label>
              <select
                style={inputStyle}
                value={metaCountryMode}
                onChange={(event) => setMetaCountryMode(event.target.value)}
              >
                <option value="all">ALL</option>
                <option value="selected">Specific countries</option>
              </select>
            </div>
            <div>
              <Label>Countries <Hint>(comma-separated 2-letter codes)</Hint></Label>
              <input
                style={inputStyle}
                placeholder="QA, US, GB"
                value={metaCountriesInput}
                onChange={(event) => setMetaCountriesInput(event.target.value.toUpperCase())}
                disabled={metaCountryMode !== "selected"}
              />
            </div>
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
            ScrapeCreators only accepts one Meta `country` per request, so specific countries are fetched one by one.
          </div>
        </Section>

        <Section title="Google Regions">
          <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 12, alignItems: "start" }}>
            <div>
              <Label>Mode</Label>
              <select
                style={inputStyle}
                value={googleRegionMode}
                onChange={(event) => setGoogleRegionMode(event.target.value)}
              >
                <option value="all">Anywhere</option>
                <option value="selected">Specific regions</option>
              </select>
            </div>
            <div>
              <Label>Regions <Hint>(comma-separated 2-letter codes)</Hint></Label>
              <input
                style={inputStyle}
                placeholder="US, GB, LB"
                value={googleRegionsInput}
                onChange={(event) => setGoogleRegionsInput(event.target.value.toUpperCase())}
                disabled={googleRegionMode !== "selected"}
              />
            </div>
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
            Google company ads use the `region` query parameter. Specific regions are fetched one by one.
          </div>
        </Section>

        <Section title="Competitors">
          {competitors.map((competitor) => (
            <div
              key={competitor.id}
              style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr auto", gap: 8, marginBottom: 8 }}
            >
              <input
                style={inputStyle}
                placeholder="Competitor name"
                value={competitor.name}
                onChange={(event) => updateCompetitor(competitor.id, "name", event.target.value)}
              />
              <input
                style={inputStyle}
                placeholder="Website domain"
                value={competitor.website}
                onChange={(event) => updateCompetitor(competitor.id, "website", event.target.value)}
              />
              <input
                style={inputStyle}
                placeholder="Meta company name / alias"
                value={competitor.searchTerm}
                onChange={(event) => updateCompetitor(competitor.id, "searchTerm", event.target.value)}
              />
              <button
                onClick={() => removeCompetitor(competitor.id)}
                style={{ ...btnStyle("ghost"), padding: "0 10px", color: C.danger }}
              >
                ✕
              </button>
            </div>
          ))}
          <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
            `website` powers Google company ads. `Meta company name / alias` is used as `companyName` for the Facebook Ad Library endpoint.
          </div>
          <button onClick={addCompetitor} style={{ ...btnStyle("ghost"), marginTop: 8, fontSize: 13 }}>
            + Add competitor
          </button>
        </Section>

        <button onClick={onClose} style={{ ...btnStyle("primary"), width: "100%", marginTop: 8 }}>
          Save & Close
        </button>
      </div>
    </div>
  );
}
