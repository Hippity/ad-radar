const API_BASE = "/api/scrapecreators";

function firstArray(...values) {
  return values.find((value) => Array.isArray(value)) ?? [];
}

function normalizeDomain(value) {
  if (!value) return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

function toFetch(fetchImpl) {
  return (...args) => fetchImpl(...args);
}

export class ScrapeCreatorsClient {
  constructor(apiKey, fetchImpl = globalThis.fetch.bind(globalThis)) {
    this.apiKey = apiKey?.trim();
    this.fetchImpl = toFetch(fetchImpl);
    this.facebookAdsCache = new Map();
    this.googleAdsCache = new Map();
  }

  async request(path, params = {}) {
    if (!this.apiKey) {
      throw new Error("Missing ScrapeCreators API key");
    }

    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        query.set(key, value);
      }
    });

    const response = await this.fetchImpl(`${API_BASE}${path}?${query.toString()}`, {
      headers: {
        "x-api-key": this.apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!response) {
      throw new Error("No response from ScrapeCreators");
    }

    if (!response.ok) {
      throw new Error(`ScrapeCreators error ${response.status}`);
    }

    return response.json();
  }

  async getFacebookCompanyAds({ companyName, startDate, endDate, country = "ALL" }) {
    return this.request("/v1/facebook/adLibrary/company/ads", {
      companyName,
      country,
      status: "ALL",
      start_date: startDate,
      end_date: endDate,
    });
  }

  async getGoogleCompanyAds({ domain, startDate, endDate }) {
    return this.request("/v1/google/company/ads", {
      domain,
      topic: "all",
      start_date: startDate,
      end_date: endDate,
      get_ad_details: "false",
    });
  }

  async getMetaAdsForCompetitor(competitor, startDate, endDate, country = "ALL") {
    const companyName = (competitor.searchTerm || competitor.name).trim();
    if (!companyName) return { results: [] };

    const cacheKey = `${companyName}|${startDate}|${endDate}|${country}`;
    if (!this.facebookAdsCache.has(cacheKey)) {
      this.facebookAdsCache.set(
        cacheKey,
        this.getFacebookCompanyAds({ companyName, startDate, endDate, country }).catch((error) => {
          this.facebookAdsCache.delete(cacheKey);
          if (error instanceof TypeError) {
            throw new Error("Network/CORS error while calling ScrapeCreators");
          }
          throw error;
        }),
      );
    }

    return this.facebookAdsCache.get(cacheKey);
  }

  async getGoogleAdsForCompetitor(competitor, startDate, endDate) {
    const domain = normalizeDomain(competitor.website);
    if (!domain) {
      return { ads: [] };
    }

    const cacheKey = `${domain}|${startDate}|${endDate}`;
    if (!this.googleAdsCache.has(cacheKey)) {
      this.googleAdsCache.set(
        cacheKey,
        this.getGoogleCompanyAds({ domain, startDate, endDate }).catch((error) => {
          this.googleAdsCache.delete(cacheKey);
          if (error instanceof TypeError) {
            throw new Error("Network/CORS error while calling ScrapeCreators");
          }
          throw error;
        }),
      );
    }

    return this.googleAdsCache.get(cacheKey);
  }

  getMetaAds(payload) {
    return firstArray(payload?.results, payload?.ads);
  }

  getGoogleAds(payload) {
    return firstArray(payload?.ads, payload?.results);
  }
}
