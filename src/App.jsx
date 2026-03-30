import { useState } from "react";
import { ScrapeCreatorsClient } from "./api/scrapeCreators";
import SetupDialog from "./components/SetupDialog";
import {
  btnStyle,
  C,
  DEFAULT_COMPETITORS,
  DEFAULT_END_DATE,
  DEFAULT_START_DATE,
} from "./constants";

function stripHtml(value) {
  return (value || "").replace(/<br\s*\/?>/gi, " ").replace(/\s+/g, " ").trim();
}

function getTextValue(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") return value.text || "";
  return "";
}

function formatDate(value) {
  if (!value) return "—";
  const parsed = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString();
}

function getMetaPlacements(ad) {
  return (ad.publisherPlatform || ad.publisher_platform || [])
    .map((value) => value.toString().replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()));
}

function getMetaPreviewImage(snapshot) {
  const firstCard = snapshot?.cards?.[0];
  return (
    firstCard?.resized_image_url
    || firstCard?.original_image_url
    || firstCard?.video_preview_image_url
    || snapshot?.videos?.[0]?.video_preview_image_url
    || snapshot?.videos?.[0]?.videoPreviewImageUrl
    || snapshot?.images?.[0]?.original_image_url
    || snapshot?.images?.[0]?.originalImageUrl
    || ""
  );
}

function getMetaCardVariants(snapshot) {
  const cards = Array.isArray(snapshot?.cards) ? snapshot.cards : [];
  if (cards.length > 0) {
    return cards.map((card, index) => ({
      id: `${index}-${card.link_url || card.original_image_url || card.video_hd_url || "card"}`,
      title: (card.title || "").trim(),
      body: stripHtml(getTextValue(card.body)),
      cta: card.cta_text || "—",
      linkUrl: card.link_url || "",
      previewImage: card.resized_image_url || card.original_image_url || card.video_preview_image_url || "",
      previewVideo: card.video_hd_url || card.video_sd_url || "",
      caption: card.caption || "",
    }));
  }

  return [{
    id: "fallback",
    title: (snapshot?.title || "").trim(),
    body: stripHtml(getTextValue(snapshot?.body)),
    cta: snapshot?.cta_text || "—",
    linkUrl: snapshot?.link_url || "",
    previewImage: getMetaPreviewImage(snapshot),
    previewVideo: snapshot?.videos?.[0]?.video_hd_url || snapshot?.videos?.[0]?.video_sd_url || "",
    caption: snapshot?.caption || "",
  }];
}

function summarizeMetaAds(payload) {
  const ads = payload?.results || payload?.ads || [];
  const placements = new Set();
  let activeCount = 0;
  let inactiveCount = 0;

  const previewAds = ads.slice(0, 6).map((ad) => {
    const snapshot = ad.snapshot || {};
    const isActive = ad.isActive ?? ad.is_active ?? false;
    if (isActive) activeCount += 1;
    else inactiveCount += 1;

    const adPlacements = getMetaPlacements(ad);
    adPlacements.forEach((placement) => placements.add(placement));
    const cardVariants = getMetaCardVariants(snapshot);

    return {
      id: ad.adArchiveID || ad.ad_archive_id || ad.url,
      pageName: ad.pageName || ad.page_name || snapshot.page_name || "Unknown page",
      actorName: snapshot.page_name || ad.page_name || "",
      body: stripHtml(getTextValue(snapshot.body)),
      cta: snapshot.cta_text || cardVariants[0]?.cta || "—",
      linkUrl: snapshot.link_url || cardVariants[0]?.linkUrl || ad.url || "",
      previewImage: getMetaPreviewImage(snapshot),
      format: snapshot.display_format || snapshot.displayFormat || "UNKNOWN",
      placements: adPlacements,
      isActive,
      startDate: formatDate(ad.startDateString || ad.start_date_string || ad.startDate || ad.start_date),
      endDate: formatDate(ad.endDateString || ad.end_date_string || ad.endDate || ad.end_date),
      countries: Array.isArray(ad.targeted_or_reached_countries)
        ? ad.targeted_or_reached_countries
        : Array.isArray(ad.targetedOrReachedCountries)
          ? ad.targetedOrReachedCountries
          : [],
      categories: Array.isArray(snapshot.page_categories) ? snapshot.page_categories : Object.values(snapshot.page_categories || {}),
      title: (snapshot.title || cardVariants[0]?.title || "").trim(),
      caption: snapshot.caption || cardVariants[0]?.caption || "",
      libraryUrl: ad.url || "",
      cardVariants,
    };
  });
  const countrySet = new Set();
  previewAds.forEach((ad) => ad.countries.forEach((country) => countrySet.add(country)));

  return {
    ads,
    placements: [...placements],
    activeCount,
    inactiveCount,
    totalAds: ads.length,
    countries: [...countrySet],
    previewAds,
    searchResultsCount: payload?.searchResultsCount ?? ads.length,
    creditsRemaining: payload?.credits_remaining ?? null,
  };
}

function summarizeGoogleAds(payload) {
  const ads = payload?.ads || payload?.results || [];
  const formats = new Set();

  const previewAds = ads.slice(0, 8).map((ad) => {
    const format = (ad.format || "unknown").toString().toUpperCase();
    formats.add(format);

    return {
      id: ad.creativeId || ad.creative_id || ad.adUrl,
      advertiserName: ad.advertiserName || ad.advertiser_name || "Unknown advertiser",
      format,
      domain: ad.domain || "—",
      url: ad.adUrl || ad.url || "",
      firstShown: formatDateTime(ad.firstShown || ad.first_shown),
      lastShown: formatDateTime(ad.lastShown || ad.last_shown),
    };
  });

  const latestAd = [...ads].sort((left, right) => {
    const leftTime = new Date(left.lastShown || left.last_shown || 0).getTime();
    const rightTime = new Date(right.lastShown || right.last_shown || 0).getTime();
    return rightTime - leftTime;
  })[0];

  return {
    ads,
    formats: [...formats],
    totalAds: ads.length,
    latestShown: latestAd ? formatDateTime(latestAd.lastShown || latestAd.last_shown) : "—",
    previewAds,
  };
}

function StatTile({ label, value, color }) {
  return (
    <div style={{ padding: "14px 16px", border: `1px solid ${C.border}`, borderRadius: 14, background: C.surface }}>
      <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600, color: color || C.text, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function SectionShell({ title, subtitle, action, children }) {
  return (
    <section
      style={{
        margin: "24px 28px",
        border: `1px solid ${C.border}`,
        borderRadius: 22,
        background: `linear-gradient(180deg, ${C.surface} 0%, ${C.bg} 100%)`,
        boxShadow: `0 20px 40px ${C.cardGlow}`,
      }}
    >
      <div
        style={{
          padding: "20px 22px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          borderBottom: `1px solid ${C.border}`,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{title}</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{subtitle}</div>
        </div>
        {action}
      </div>
      <div style={{ padding: "20px 22px" }}>
        {children}
      </div>
    </section>
  );
}

function MetaAdCard({ ad }) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        overflow: "hidden",
        background: C.surface,
      }}
    >
      <div style={{ height: 170, background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {ad.cardVariants[0]?.previewVideo ? (
          <video
            src={ad.cardVariants[0].previewVideo}
            poster={ad.cardVariants[0].previewImage || ad.previewImage}
            controls
            muted
            playsInline
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : ad.previewImage ? (
          <img src={ad.previewImage} alt={ad.pageName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ color: C.muted, fontSize: 11 }}>No preview image</div>
        )}
      </div>
      <div style={{ padding: 14 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          <span style={{
            padding: "4px 8px",
            borderRadius: 999,
            background: ad.isActive ? C.activeBg : C.inactiveBg,
            color: ad.isActive ? C.activeText : C.inactiveText,
            fontSize: 10,
            fontWeight: 700,
          }}>
            {ad.isActive ? "Active" : "Inactive"}
          </span>
          <span style={{
            padding: "4px 8px",
            borderRadius: 999,
            background: C.metaBg,
            color: C.metaText,
            fontSize: 10,
            fontWeight: 700,
          }}>
            {ad.format}
          </span>
          {ad.placements.map((placement) => (
            <span key={placement} style={{
              padding: "4px 8px",
              borderRadius: 999,
              background: C.bg,
              border: `1px solid ${C.border}`,
              color: C.text,
              fontSize: 10,
            }}>
              {placement}
            </span>
          ))}
        </div>

        <div style={{ fontSize: 14, fontWeight: 600 }}>{ad.pageName}</div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{ad.actorName}</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12, fontSize: 11 }}>
          <div><span style={{ color: C.muted }}>Start:</span> {ad.startDate}</div>
          <div><span style={{ color: C.muted }}>End:</span> {ad.endDate}</div>
        </div>

        {ad.categories.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            {ad.categories.map((category) => (
              <span key={category} style={{
                padding: "3px 7px",
                borderRadius: 999,
                background: C.bg,
                border: `1px solid ${C.border}`,
                color: C.muted,
                fontSize: 10,
              }}>
                {category}
              </span>
            ))}
          </div>
        )}

        {ad.countries.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            {ad.countries.map((country) => (
              <span key={country} style={{
                padding: "3px 7px",
                borderRadius: 999,
                background: C.metaBg,
                border: `1px solid ${C.meta}40`,
                color: C.metaText,
                fontSize: 10,
              }}>
                {country}
              </span>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
          <button onClick={() => setShowDetails((current) => !current)} style={btnStyle("ghost")}>
            {showDetails ? "Hide details" : "Show details"}
          </button>
          {ad.linkUrl && (
            <a href={ad.linkUrl} target="_blank" rel="noreferrer" style={{ color: C.accent, fontSize: 11, display: "inline-block" }}>
              Open destination
            </a>
          )}
          {ad.libraryUrl && (
            <a href={ad.libraryUrl} target="_blank" rel="noreferrer" style={{ color: C.metaText, fontSize: 11, display: "inline-block" }}>
              Open ad library
            </a>
          )}
        </div>

        {showDetails && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
            {ad.title && (
              <div style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>
                {ad.title}
              </div>
            )}
            <div style={{ fontSize: 12, color: C.text, marginTop: 8, lineHeight: 1.5 }}>
              {ad.body || "No body text"}
            </div>
            {ad.caption && (
              <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
                {ad.caption}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MetaCompanyCard({ competitor, result, activeCountries }) {
  if (!result) return null;

  if (result.status === "loading") {
    return <div style={{ padding: 18, border: `1px solid ${C.border}`, borderRadius: 16 }}>Checking Meta ads...</div>;
  }

  if (result.error) {
    return (
      <div style={{ padding: 18, border: `1px solid ${C.danger}40`, borderRadius: 16, background: "#1a0a0a" }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{competitor.name}</div>
        <div style={{ color: C.danger, fontSize: 12, marginTop: 8 }}>{result.error}</div>
      </div>
    );
  }

  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 18, overflow: "hidden", background: C.surface }}>
      <div style={{ padding: 18, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{competitor.name}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
              Meta company: {competitor.searchTerm || competitor.name}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <StatTile label="Ads" value={result.summary.totalAds} />
            <StatTile label="Active" value={result.summary.activeCount} color={C.activeText} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          {result.summary.placements.length > 0 ? result.summary.placements.map((placement) => (
            <span key={placement} style={{
              padding: "5px 9px",
              borderRadius: 999,
              fontSize: 11,
              background: C.metaBg,
              color: C.metaText,
              border: `1px solid ${C.meta}40`,
            }}>
              {placement}
            </span>
          )) : (
            <span style={{ color: C.muted, fontSize: 11 }}>No publisher platforms returned</span>
          )}
        </div>

        {result.summary.countries.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            {result.summary.countries.map((country) => (
              <span key={country} style={{
                padding: "5px 9px",
                borderRadius: 999,
                fontSize: 11,
                background: C.bg,
                color: C.text,
                border: `1px solid ${C.border}`,
              }}>
                {country}
              </span>
            ))}
          </div>
        )}

        {activeCountries.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            {activeCountries.map((country) => (
              <span key={country} style={{
                padding: "5px 9px",
                borderRadius: 999,
                fontSize: 11,
                background: C.activeBg,
                color: C.activeText,
                border: `1px solid ${C.activeText}40`,
              }}>
                Active in {country}
              </span>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: 18 }}>
        {result.summary.previewAds.length === 0 ? (
          <div style={{ color: C.muted, fontSize: 12 }}>No Meta ads found for this date range.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
            {result.summary.previewAds.map((ad) => <MetaAdCard key={ad.id} ad={ad} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function GoogleCompanyCard({ competitor, result }) {
  if (!result) return null;

  if (result.status === "loading") {
    return <div style={{ padding: 18, border: `1px solid ${C.border}`, borderRadius: 16 }}>Checking Google ads...</div>;
  }

  if (result.error) {
    return (
      <div style={{ padding: 18, border: `1px solid ${C.danger}40`, borderRadius: 16, background: "#1a0a0a" }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{competitor.name}</div>
        <div style={{ color: C.danger, fontSize: 12, marginTop: 8 }}>{result.error}</div>
      </div>
    );
  }

  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 18, background: C.surface }}>
      <div style={{ padding: 18, borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{competitor.name}</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
            Domain: {competitor.website || "Missing website"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <StatTile label="Ads" value={result.summary.totalAds} />
          <StatTile label="Formats" value={result.summary.formats.length || "—"} color={C.googleText} />
          <StatTile label="Latest Seen" value={result.summary.latestShown} color={C.googleText} />
        </div>
      </div>

      <div style={{ padding: 18 }}>
        {result.summary.formats.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            {result.summary.formats.map((format) => (
              <span key={format} style={{
                padding: "5px 9px",
                borderRadius: 999,
                fontSize: 11,
                background: C.googleBg,
                color: C.googleText,
                border: `1px solid ${C.google}40`,
              }}>
                {format}
              </span>
            ))}
          </div>
        )}

        {result.summary.previewAds.length === 0 ? (
          <div style={{ color: C.muted, fontSize: 12 }}>No Google ads found for this date range.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {result.summary.previewAds.map((ad) => (
              <div key={ad.id} style={{ padding: 12, border: `1px solid ${C.border}`, borderRadius: 12, background: C.bg }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{ad.advertiserName}</div>
                  <span style={{ color: C.googleText, fontSize: 11 }}>{ad.format}</span>
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>{ad.domain}</div>
                <div style={{ fontSize: 11, color: C.text, marginTop: 10 }}>
                  First shown: {ad.firstShown}
                </div>
                <div style={{ fontSize: 11, color: C.text, marginTop: 4 }}>
                  Last shown: {ad.lastShown}
                </div>
                {ad.url && (
                  <a href={ad.url} target="_blank" rel="noreferrer" style={{ color: C.accent, fontSize: 11, display: "inline-block", marginTop: 10 }}>
                    Open ad
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [scrapeCreatorsApiKey, setScrapeCreatorsApiKey] = useState("");
  const [competitors, setCompetitors] = useState(DEFAULT_COMPETITORS);
  const [startDate, setStartDate] = useState(DEFAULT_START_DATE);
  const [endDate, setEndDate] = useState(DEFAULT_END_DATE);
  const [metaCountryMode, setMetaCountryMode] = useState("selected");
  const [metaCountriesInput, setMetaCountriesInput] = useState("CN, US, UK, LB");
  const [selectedMetaCountry, setSelectedMetaCountry] = useState("ALL");
  const [selectedMetaCompetitorId, setSelectedMetaCompetitorId] = useState("");
  const [showSetup, setShowSetup] = useState(false);

  const [metaResults, setMetaResults] = useState({});
  const [googleResults, setGoogleResults] = useState({});
  const [metaLoading, setMetaLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [metaProgress, setMetaProgress] = useState(0);
  const [googleProgress, setGoogleProgress] = useState(0);
  const [metaLastRun, setMetaLastRun] = useState(null);
  const [googleLastRun, setGoogleLastRun] = useState(null);

  const validCompetitors = competitors.filter((competitor) => competitor.name.trim());
  const parsedMetaCountries = [...new Set(
    metaCountriesInput
      .split(",")
      .map((value) => value.trim().toUpperCase())
      .filter((value) => /^[A-Z]{2}$/.test(value)),
  )];
  const metaCountryOptions = metaCountryMode === "selected" && parsedMetaCountries.length > 0
    ? parsedMetaCountries
    : ["ALL"];
  const activeMetaCountry = metaCountryOptions.includes(selectedMetaCountry)
    ? selectedMetaCountry
    : metaCountryOptions[0];
  const metaResultKey = (competitorId, country) => `${competitorId}|${country}`;
  const activeMetaCompetitor = validCompetitors.find((competitor) => String(competitor.id) === String(selectedMetaCompetitorId))
    || validCompetitors[0]
    || null;
  const getCompetitorActiveCountries = (competitorId) => metaCountryOptions.filter((country) => {
    const result = metaResults[metaResultKey(competitorId, country)];
    return (result?.summary?.activeCount || 0) > 0;
  });
  const getCompetitorTotalsAcrossCountries = (competitorId) => ({
    totalAds: metaCountryOptions.reduce(
      (sum, country) => sum + (metaResults[metaResultKey(competitorId, country)]?.summary?.totalAds || 0),
      0,
    ),
    activeAds: metaCountryOptions.reduce(
      (sum, country) => sum + (metaResults[metaResultKey(competitorId, country)]?.summary?.activeCount || 0),
      0,
    ),
  });

  const validateInputs = () => {
    if (!scrapeCreatorsApiKey.trim()) {
      alert("Please add your ScrapeCreators API key in Settings first.");
      return false;
    }

    if (!validCompetitors.length) {
      alert("Add at least one competitor.");
      return false;
    }

    if (!startDate || !endDate) {
      alert("Set both start and end dates in Settings.");
      return false;
    }

    if (metaCountryMode === "selected" && parsedMetaCountries.length === 0) {
      alert("Add at least one valid 2-letter Meta country code, for example QA, US, GB.");
      return false;
    }

    return true;
  };

  const runMetaAds = async () => {
    if (!validateInputs()) return;

    const api = new ScrapeCreatorsClient(scrapeCreatorsApiKey);
    setMetaLoading(true);
    setMetaProgress(0);

    const initial = {};
    validCompetitors.forEach((competitor) => {
      metaCountryOptions.forEach((country) => {
        initial[metaResultKey(competitor.id, country)] = { status: "loading" };
      });
    });
    setMetaResults(initial);

    let completed = 0;
    const total = validCompetitors.length * metaCountryOptions.length;
    for (const country of metaCountryOptions) {
      for (const competitor of validCompetitors) {
        try {
          const payload = await api.getMetaAdsForCompetitor(competitor, startDate, endDate, country);
          setMetaResults((current) => ({
            ...current,
            [metaResultKey(competitor.id, country)]: {
              status: "ready",
              summary: summarizeMetaAds(payload),
            },
          }));
        } catch (error) {
          setMetaResults((current) => ({
            ...current,
            [metaResultKey(competitor.id, country)]: {
              status: "error",
              error: error.message,
            },
          }));
        }

        completed += 1;
        setMetaProgress(Math.round((completed / total) * 100));
      }
    }

    setMetaLastRun(new Date());
    setMetaLoading(false);
  };

  const runGoogleAds = async () => {
    if (!validateInputs()) return;

    const api = new ScrapeCreatorsClient(scrapeCreatorsApiKey);
    setGoogleLoading(true);
    setGoogleProgress(0);

    const initial = {};
    validCompetitors.forEach((competitor) => {
      initial[competitor.id] = { status: "loading" };
    });
    setGoogleResults(initial);

    let completed = 0;
    for (const competitor of validCompetitors) {
      try {
        const payload = await api.getGoogleAdsForCompetitor(competitor, startDate, endDate);
        setGoogleResults((current) => ({
          ...current,
          [competitor.id]: {
            status: "ready",
            summary: summarizeGoogleAds(payload),
          },
        }));
      } catch (error) {
        setGoogleResults((current) => ({
          ...current,
          [competitor.id]: {
            status: "error",
            error: error.message,
          },
        }));
      }

      completed += 1;
      setGoogleProgress(Math.round((completed / validCompetitors.length) * 100));
    }

    setGoogleLastRun(new Date());
    setGoogleLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'IBM Plex Mono', 'Fira Code', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
        input, textarea { font-family: 'IBM Plex Mono', monospace !important; }
        input:focus, textarea:focus { border-color: ${C.accent} !important; box-shadow: 0 0 0 3px ${C.accentGlow}; }
        a { text-decoration: none; }
      `}</style>

      <div style={{ padding: "28px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>
              <span style={{ color: C.accent }}>ad</span>radar
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>
              Separate workspaces for Meta Ads and Google Ads across {validCompetitors.length} competitors.
            </div>
          </div>
          <button onClick={() => setShowSetup(true)} style={btnStyle("ghost")}>⚙ Settings</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginTop: 22 }}>
          <StatTile label="Competitors" value={validCompetitors.length} />
          <StatTile label="Start Date" value={startDate} />
          <StatTile label="End Date" value={endDate} />
        </div>

      </div>

      <SectionShell
        title="Meta Ads"
        subtitle="Use the Facebook Ad Library company ads endpoint and render placements, creative previews, CTA details, reach, and audience hints."
        action={(
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {metaLastRun && <span style={{ fontSize: 11, color: C.muted }}>Last run: {metaLastRun.toLocaleString()}</span>}
            <button onClick={runMetaAds} style={btnStyle("scan")} disabled={metaLoading}>
              {metaLoading ? `Running ${metaProgress}%` : "Fetch Meta Ads"}
            </button>
          </div>
        )}
      >
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
            Per Competitor Results
          </div>
          {validCompetitors.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    <th style={{ textAlign: "left", padding: "10px 12px", color: C.muted, fontWeight: 500 }}>Competitor</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", color: C.muted, fontWeight: 500 }}>Active Countries</th>
                  </tr>
                </thead>
                <tbody>
                  {validCompetitors.map((competitor) => {
                    const activeCountries = getCompetitorActiveCountries(competitor.id);
                    return (
                      <tr key={competitor.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: "12px", color: C.text, fontWeight: 600 }}>{competitor.name}</td>
                        <td style={{ padding: "12px" }}>
                          {activeCountries.length > 0 ? (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              {activeCountries.map((country) => (
                                <span key={country} style={{
                                  padding: "4px 8px",
                                  borderRadius: 999,
                                  fontSize: 10,
                                  background: C.activeBg,
                                  color: C.activeText,
                                  border: `1px solid ${C.activeText}40`,
                                }}>
                                  {country}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: C.muted }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ color: C.muted, fontSize: 12 }}>No competitors configured yet.</div>
          )}
        </div>

        {metaCountryOptions.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
              Countries Searching In
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {metaCountryOptions.map((country) => (
                <span key={country} style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  fontSize: 11,
                  background: C.bg,
                  color: C.metaText,
                  border: `1px solid ${C.meta}40`,
                }}>
                  {country}
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
          <select
            style={{ ...btnStyle("ghost"), minWidth: 180 }}
            value={activeMetaCompetitor?.id ?? ""}
            onChange={(event) => setSelectedMetaCompetitorId(event.target.value)}
          >
            {validCompetitors.map((competitor) => (
              <option key={competitor.id} value={competitor.id}>{competitor.name}</option>
            ))}
          </select>
        </div>
        {activeMetaCompetitor && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 18 }}>
            <StatTile
              label="Total Ads"
              value={getCompetitorTotalsAcrossCountries(activeMetaCompetitor.id).totalAds || "—"}
              color={C.metaText}
            />
            <StatTile
              label="Active"
              value={getCompetitorTotalsAcrossCountries(activeMetaCompetitor.id).activeAds || "—"}
              color={C.activeText}
            />
          </div>
        )}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 18 }}>
          <select
            style={{ ...btnStyle("ghost"), minWidth: 140 }}
            value={activeMetaCountry}
            onChange={(event) => setSelectedMetaCountry(event.target.value)}
          >
            {metaCountryOptions.map((country) => (
              <option key={country} value={country}>{country}</option>
            ))}
          </select>
        </div>
        {validCompetitors.length === 0 || !activeMetaCompetitor ? (
          <div style={{ color: C.muted, fontSize: 12 }}>No competitors configured yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            <MetaCompanyCard
              key={`${activeMetaCompetitor.id}-${activeMetaCountry}`}
              competitor={activeMetaCompetitor}
              result={metaResults[metaResultKey(activeMetaCompetitor.id, activeMetaCountry)]}
              activeCountries={getCompetitorActiveCountries(activeMetaCompetitor.id)}
            />
          </div>
        )}
      </SectionShell>

      <SectionShell
        title="Google Ads"
        subtitle="Use the Google company ads endpoint and render advertiser, format mix, and latest-seen timing across the selected date range."
        action={(
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {googleLastRun && <span style={{ fontSize: 11, color: C.muted }}>Last run: {googleLastRun.toLocaleString()}</span>}
            <button onClick={runGoogleAds} style={btnStyle("scan")} disabled={googleLoading}>
              {googleLoading ? `Running ${googleProgress}%` : "Fetch Google Ads"}
            </button>
          </div>
        )}
      >
        {validCompetitors.length === 0 ? (
          <div style={{ color: C.muted, fontSize: 12 }}>No competitors configured yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {validCompetitors.map((competitor) => (
              <GoogleCompanyCard key={competitor.id} competitor={competitor} result={googleResults[competitor.id]} />
            ))}
          </div>
        )}
      </SectionShell>

      {showSetup && (
        <SetupDialog
          scrapeCreatorsApiKey={scrapeCreatorsApiKey}
          setScrapeCreatorsApiKey={setScrapeCreatorsApiKey}
          competitors={competitors}
          setCompetitors={setCompetitors}
          metaCountryMode={metaCountryMode}
          setMetaCountryMode={setMetaCountryMode}
          metaCountriesInput={metaCountriesInput}
          setMetaCountriesInput={setMetaCountriesInput}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          onClose={() => setShowSetup(false)}
        />
      )}
    </div>
  );
}
