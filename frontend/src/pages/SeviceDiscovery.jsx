import React, { useState, useEffect, useMemo } from "react";
import { 
  Search, 
  RotateCcw, 
  SlidersHorizontal, 
  ArrowLeft, 
  ArrowRight, 
  Sparkles, 
  Users 
} from "lucide-react";
import api, { errorMessage } from "../api/client";
import ProviderCard from "../components/ProviderCard";
import { Alert } from "../components/ui";

const DEFAULT_AREAS = [
  "Dhanmondi", "Gulshan-1", "Gulshan-2", "Banani", "Uttara",
  "Mirpur", "Mohakhali", "Bashundhara R/A", "Badda", "Mohammadpur"
];

// Rich Visual Categories including dedicated Pest Control
const CATEGORY_CARDS = [
  {
    key: "ac",
    name: "AC Repair & Servicing",
    // STRICT keywords: no standalone "servicing" word so other services don't match
    matchKeywords: ["ac repair", "ac servicing", "air condition", "air conditioner", "cooling"],
    image: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=700&q=80",
    description: "Master jet cleaning, gas charging, circuit PCB fix & leakage repair.",
    badge: "Most Booked"
  },
  {
    key: "electric",
    name: "Electrical & Wiring",
    matchKeywords: ["electric", "wiring", "fittings", "switch", "short circuit", "fan", "cctv", "generator", "ips"],
    image: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=700&q=80",
    description: "Circuit breaker diagnostics, DB box fittings & house wiring.",
    badge: "Certified Pros"
  },
  {
    key: "plumbing",
    name: "Plumbing & Sanitary",
    matchKeywords: ["plumb", "pipe", "sanitary", "leak", "tap", "motor", "bathroom", "water tank", "drain"],
    image: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=700&q=80",
    description: "Water line leakage, pump maintenance, commode & sink repair.",
    badge: "Emergency"
  },
  {
    key: "cleaning",
    name: "Deep Cleaning & Maid",
    matchKeywords: ["deep home cleaning", "sofa & carpet", "kitchen cleaning", "water tank cleaning", "maid", "wash", "floor cleaning"],
    image: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=700&q=80",
    description: "Kitchen degreasing, bathroom descaling & full sofa cleaning.",
    badge: "Eco-Friendly"
  },
  {
    key: "carpentry",
    name: "Carpentry & Furniture",
    matchKeywords: ["carpent", "wood", "furniture", "door", "window", "modular kitchen", "lock", "cabinet"],
    image: "https://images.unsplash.com/photo-1538688525198-9b88f6f53126?auto=format&fit=crop&w=700&q=80",
    description: "Door lock replace, wardrobe dismantling & bespoke wooden work.",
    badge: "Craftsmen"
  },
  {
    key: "pest",
    name: "Pest Control & Fumigation",
    matchKeywords: ["pest", "cockroach", "termite", "rodent", "ant", "bedbug", "fumigation", "insect"],
    image: "https://images.unsplash.com/photo-1587393855524-087f83d95bc9?auto=format&fit=crop&w=700&q=80",
    description: "Cockroach geling, anti-termite piping & commercial rodent eradication.",
    badge: "Certified Pros"
  },
  {
    key: "appliance",
    name: "Home Appliance Repair",
    matchKeywords: ["appliance", "fridge", "refrigerator", "washing machine", "oven", "tv", "microwave"],
    image: "https://images.unsplash.com/photo-1585338107529-13afc5f02586?auto=format&fit=crop&w=700&q=80",
    description: "Refrigerator gas leakage, washing motor & microwave servicing.",
    badge: "Warranty Backed"
  }
];

export default function ServiceDiscovery() {
  const [providers, setProviders] = useState([]);
  const [areas, setAreas] = useState(DEFAULT_AREAS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(null);
  const [selectedArea, setSelectedArea] = useState("");
  const [minRating, setMinRating] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sortBy, setSortBy] = useState("top_rated");

  useEffect(() => {
    setLoading(true);
    setError("");

    Promise.all([
      api.get("/services/providers").catch(() => ({ data: [] })),
      api.get("/services/areas").catch(() => ({ data: [] }))
    ])
      .then(([provRes, areaRes]) => {
        const provList = provRes.data?.items || provRes.data || [];
        setProviders(provList);

        const apiAreas = (areaRes.data || [])
          .map((a) => (typeof a === "object" ? a.area || a.name : a))
          .filter(Boolean);

        const providerAreas = provList.flatMap((p) => {
          if (Array.isArray(p.areas)) {
            return p.areas.map((a) => (typeof a === "object" ? a.area || a.name : a));
          }
          return [];
        }).filter(Boolean);

        const uniqueAreas = Array.from(new Set([...apiAreas, ...providerAreas, ...DEFAULT_AREAS]));
        setAreas(uniqueAreas);
      })
      .catch((err) => {
        setError(errorMessage(err) || "Failed to load directory.");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleClear = () => {
    setSearch("");
    setActiveCategory(null);
    setSelectedArea("");
    setMinRating("");
    setMinPrice("");
    setMaxPrice("");
    setVerifiedOnly(false);
    setSortBy("top_rated");
  };

  // Precise category matcher
  const providerMatchesCategory = (p, cat) => {
    if (!cat) return true;

    // 1. Direct key match if category array exists
    if (Array.isArray(p.categories) && p.categories.includes(cat.key)) {
      return true;
    }

    // 2. Specialty & headline check
    const list = [];
    if (Array.isArray(p.specialties)) {
      list.push(...p.specialties.map(s => typeof s === "object" ? (s.name || s.category?.name || "") : s));
    }
    if (Array.isArray(p.services)) {
      list.push(...p.services.map(s => typeof s === "object" ? s.name : s));
    }

    const allText = [
      ...list,
      p.headline || "",
      p.bio || ""
    ].join(" ").toLowerCase();

    // STRICT GUARD: If searching AC category, cockroach or pest providers must NEVER match
    if (cat.key === "ac" && (allText.includes("cockroach") || allText.includes("pest") || allText.includes("termite"))) {
      return false;
    }

    // STRICT GUARD: If searching Deep Cleaning category, pest/cockroach must not match
    if (cat.key === "cleaning" && (allText.includes("cockroach") || allText.includes("pest") || allText.includes("termite"))) {
      return false;
    }

    return cat.matchKeywords.some((kw) => allText.includes(kw.toLowerCase()));
  };

  const getProviderCountForCategory = (cat) => {
    return providers.filter((p) => providerMatchesCategory(p, cat)).length;
  };

  const filteredProviders = useMemo(() => {
    if (!activeCategory && !search.trim()) return [];

    return providers.filter((p) => {
      if (activeCategory && !providerMatchesCategory(p, activeCategory)) {
        return false;
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        const nameMatch = (p.full_name || "").toLowerCase().includes(q);
        const headMatch = (p.headline || "").toLowerCase().includes(q);
        const bioMatch = (p.bio || "").toLowerCase().includes(q);
        if (!nameMatch && !headMatch && !bioMatch) return false;
      }

      if (selectedArea) {
        const pAreas = Array.isArray(p.areas)
          ? p.areas.map((a) => (typeof a === "object" ? a.area || a.name : a))
          : [];
        if (!pAreas.some((a) => String(a).toLowerCase() === selectedArea.toLowerCase())) {
          return false;
        }
      }

      if (minRating && Number(p.avg_rating || 0) < Number(minRating)) {
        return false;
      }

      const rate = Number(p.base_hourly_rate || 0);
      if (minPrice && rate < Number(minPrice)) return false;
      if (maxPrice && rate > Number(maxPrice)) return false;

      if (verifiedOnly && !p.is_contact_verified && !p.is_credential_verified) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === "top_rated") return (b.avg_rating || 0) - (a.avg_rating || 0);
      if (sortBy === "price_low") return (a.base_hourly_rate || 0) - (b.base_hourly_rate || 0);
      if (sortBy === "price_high") return (b.base_hourly_rate || 0) - (a.base_hourly_rate || 0);
      return 0;
    });
  }, [providers, activeCategory, search, selectedArea, minRating, minPrice, maxPrice, verifiedOnly, sortBy]);

  return (
    <div className="min-h-screen bg-slate-50/70 pb-20 font-sans">
      <section className="bg-white border-b border-slate-200/80 pt-10 pb-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
              <Sparkles size={13} /> On-Demand Verified Specialists
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Find a trusted home service <span className="text-indigo-600">professional</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 max-w-2xl">
              Choose a category to browse specialists or filter technicians by your location and budget.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-3.5 text-slate-400" size={18} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by company name, technician, AC repair, electrician..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all shadow-xs"
              />
            </div>
            {activeCategory && (
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full sm:w-auto px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-indigo-600 shadow-xs cursor-pointer"
              >
                <option value="top_rated">Top rated</option>
                <option value="price_low">Price: Low to High</option>
                <option value="price_high">Price: High to Low</option>
              </select>
            )}
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {error && (
          <div className="mb-6">
            <Alert kind="error">{error}</Alert>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Filters */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <SlidersHorizontal size={14} className="text-indigo-600" /> Filters
                </span>
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-xs font-bold text-slate-400 hover:text-indigo-600 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <RotateCcw size={12} /> Clear all
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Service Category
                </label>
                <select
                  value={activeCategory ? activeCategory.key : ""}
                  onChange={(e) => {
                    const key = e.target.value;
                    const found = CATEGORY_CARDS.find((c) => c.key === key);
                    setActiveCategory(found || null);
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-600 cursor-pointer"
                >
                  <option value="">All Categories (Overview)</option>
                  {CATEGORY_CARDS.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Area / Thana
                </label>
                <select
                  value={selectedArea}
                  onChange={(e) => setSelectedArea(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-600 cursor-pointer"
                >
                  <option value="">Anywhere in Dhaka</option>
                  {areas.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Minimum Rating
                </label>
                <select
                  value={minRating}
                  onChange={(e) => setMinRating(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-600 cursor-pointer"
                >
                  <option value="">Any rating</option>
                  <option value="4.5">4.5 & up</option>
                  <option value="4.0">4.0 & up</option>
                  <option value="3.5">3.5 & up</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Hourly Rate (৳)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                  <span className="text-slate-300">-</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={verifiedOnly}
                    onChange={(e) => setVerifiedOnly(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-semibold text-slate-700">Credentials verified only</span>
                </label>
              </div>
            </div>
          </div>

          {/* Right Section */}
          <div className="lg:col-span-3 space-y-4">
            {!activeCategory && !search.trim() ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                      Service Categories
                    </h2>
                    <p className="text-xs text-slate-500">
                      Select a category to view active professionals and book appointments
                    </p>
                  </div>
                  <span className="text-xs font-bold text-slate-400">
                    {CATEGORY_CARDS.length} Categories
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {CATEGORY_CARDS.map((cat) => {
                    const count = getProviderCountForCategory(cat);
                    return (
                      <div
                        key={cat.key}
                        onClick={() => setActiveCategory(cat)}
                        className="group relative bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs hover:shadow-xl hover:border-indigo-400 hover:-translate-y-1 transition-all duration-200 cursor-pointer flex flex-col"
                      >
                        <div className="h-40 w-full overflow-hidden relative bg-slate-100">
                          <img
                            src={cat.image}
                            alt={cat.name}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent"></div>
                          
                          <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-xs text-slate-900 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full shadow-xs">
                            {cat.badge}
                          </span>

                          <div className="absolute bottom-3 left-3 right-3">
                            <h3 className="text-white font-extrabold text-base leading-tight drop-shadow-xs">
                              {cat.name}
                            </h3>
                          </div>
                        </div>

                        <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                            {cat.description}
                          </p>

                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-500 flex items-center gap-1.5">
                              <Users size={13} className="text-indigo-600" />
                              <strong className="text-slate-900">{count}</strong> {count === 1 ? "Specialist" : "Specialists"} Available
                            </span>
                            <span className="font-bold text-indigo-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                              Explore <ArrowRight size={13} />
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveCategory(null);
                        setSearch("");
                      }}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                    >
                      <ArrowLeft size={16} />
                    </button>
                    <div>
                      <h2 className="text-base font-extrabold text-slate-900">
                        {activeCategory ? activeCategory.name : `Search: "${search}"`}
                      </h2>
                      <p className="text-xs text-slate-500">
                        {filteredProviders.length} verified {filteredProviders.length === 1 ? "technician" : "technicians"} providing this service
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveCategory(null);
                      setSearch("");
                    }}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                  >
                    View All Categories ✕
                  </button>
                </div>

                {loading ? (
                  <div className="min-h-[300px] flex items-center justify-center">
                    <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : filteredProviders.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center space-y-3">
                    <p className="text-sm font-bold text-slate-700">No technicians found in this category.</p>
                    <p className="text-xs text-slate-400">Try adjusting your area filter or clear price limitations.</p>
                    <button
                      type="button"
                      onClick={() => setActiveCategory(null)}
                      className="px-4 py-2 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold transition-colors cursor-pointer"
                    >
                      Browse Other Categories
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredProviders.map((p) => (
                      <ProviderCard key={p.id} provider={p} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
