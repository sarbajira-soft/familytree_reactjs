import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchTutorials, fetchTutorialLanguages } from '../services/tutorial.service';
import { useLanguage } from '../Contexts/LanguageContext';

import { 
  FiSearch, 
  FiGrid, 
  FiPlayCircle, 
  FiBookOpen, 
  FiLayers, 
  FiClock, 
  FiArrowRight, 
  FiCalendar, 
  FiInbox
} from 'react-icons/fi';
import EmptyState from '../Components/EmptyState';

// Premium Skeleton Loading Card
function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm animate-pulse space-y-4">
      <div className="relative aspect-[16/10] w-full rounded-xl bg-slate-100 dark:bg-slate-800"></div>
      <div className="space-y-2">
        <div className="h-4 w-1/4 rounded bg-slate-100 dark:bg-slate-800"></div>
        <div className="h-5 w-3/4 rounded bg-slate-100 dark:bg-slate-800"></div>
        <div className="space-y-1.5 mt-2">
          <div className="h-3.5 w-full rounded bg-slate-100 dark:bg-slate-800"></div>
          <div className="h-3.5 w-4/5 rounded bg-slate-100 dark:bg-slate-800"></div>
        </div>
      </div>
      <div className="flex justify-between items-center pt-3 border-t border-slate-50 dark:border-slate-800/50">
        <div className="h-3 w-1/4 rounded bg-slate-100 dark:bg-slate-800"></div>
        <div className="h-3 w-1/5 rounded bg-slate-100 dark:bg-slate-800"></div>
      </div>
    </div>
  );
}

export default function TutorialsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tutorialLanguages, setTutorialLanguages] = useState([
    { code: 'english', label: 'English' },
    { code: 'tamil', label: 'Tamil (தமிழ்)' },
    { code: 'hindi', label: 'Hindi (हिन्दी)' },
    { code: 'telugu', label: 'Telugu (తెలుగు)' },
    { code: 'malayalam', label: 'Malayalam (മലയാളம்)' },
    { code: 'japanese', label: 'Japanese (日本語)' },
    { code: 'kannada', label: 'Kannada (ಕನ್ನಡ)' },
    { code: 'spanish', label: 'Spanish (Español)' },
  ]);

  useEffect(() => {
    async function loadLangs() {
      try {
        const res = await fetchTutorialLanguages();
        if (res && Array.isArray(res)) {
          const list = res.map(lang => ({
            code: lang.name.toLowerCase().trim(),
            label: lang.name,
          }));
          const labelsMap = {
            english: 'English',
            tamil: 'Tamil (தமிழ்)',
            hindi: 'Hindi (हिन्दी)',
            telugu: 'Telugu (తెలుగు)',
            malayalam: 'Malayalam (മലയാളம்)',
            japanese: 'Japanese (日本語)',
            kannada: 'Kannada (ಕನ್ನಡ)',
            spanish: 'Spanish (Español)',
          };
          const listWithLabels = list.map(item => ({
            code: item.code,
            label: labelsMap[item.code] || item.label,
          }));
          setTutorialLanguages(listWithLabels);
        }
      } catch (e) {
        console.error('Failed to load dynamic tutorial languages:', e);
      }
    }
    loadLangs();
  }, []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(12);

  // Filter States
  const [qInput, setQInput] = useState('');
  const [activeQ, setActiveQ] = useState('');
  const [activeType, setActiveType] = useState('all'); // all | video | article | mixed

  const { language: globalLanguage } = useLanguage();
  const [tutorialLang, setTutorialLang] = useState(() => {
    return localStorage.getItem('tutorialLanguage') || globalLanguage || 'english';
  });

  useEffect(() => {
    if (!localStorage.getItem('tutorialLanguage') && globalLanguage) {
      setTutorialLang(globalLanguage);
    }
  }, [globalLanguage]);

  // Sync state from SearchParams
  useEffect(() => {
    const spPage = Math.max(1, Number(searchParams.get('page') || 1));
    setPage(spPage);

    const spQ = searchParams.get('q') || '';
    const spType = searchParams.get('type') || 'all';

    setActiveQ(spQ);
    setQInput(spQ);
    setActiveType(spType);
  }, [searchParams]);

  const updateParams = (patch) => {
    const next = new URLSearchParams(searchParams);
    const setOrDel = (k, v) => {
      const s = String(v ?? '').trim();
      if (s && s !== 'all') next.set(k, s);
      else next.delete(k);
    };

    if (patch?.page !== undefined) {
      const p = Math.max(1, Number(patch.page || 1));
      if (p > 1) next.set('page', String(p));
      else next.delete('page');
    }

    if (patch?.q !== undefined) setOrDel('q', patch.q);
    if (patch?.type !== undefined) setOrDel('type', patch.type);

    setSearchParams(next, { replace: true });
  };

  // Fetch tutorials
  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const res = await fetchTutorials({
          page,
          limit,
          q: activeQ,
          contentType: activeType === 'all' ? '' : activeType,
          lang: tutorialLang,
        });

        if (!alive) return;
        setRows(Array.isArray(res?.data) ? res.data : []);
        setTotal(Number(res?.total || 0));
      } catch (e) {
        if (!alive) return;
        setError(e?.message || 'Failed to load tutorials. Please try again later.');
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [page, limit, activeQ, activeType, tutorialLang]);

  const totalPages = Math.ceil(total / limit) || 1;

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    updateParams({ q: qInput.trim(), page: 1 });
  };

  const handleRemoveFilter = (key) => {
    updateParams({ [key]: 'all', page: 1 });
  };

  const handleRemoveSearch = () => {
    updateParams({ q: '', page: 1 });
  };

  const handleResetAll = () => {
    updateParams({ q: '', type: 'all', page: 1 });
  };

  const handleTypeSelect = (type) => {
    updateParams({ type, page: 1 });
  };

  const hasActiveFilters = Boolean(activeQ || (activeType && activeType !== 'all'));

  // Keep thumbnail fallbacks aligned with the Familyss primary/secondary theme.
  const getGradientClass = (id, title) => {
    const hash = (String(id || title || '')).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const gradients = [
      "from-primary-700 via-primary-600 to-secondary-500",
      "from-primary-800 via-primary-600 to-primary-400",
      "from-secondary-600 via-secondary-500 to-primary-600",
      "from-primary-600 via-primary-500 to-secondary-400",
      "from-primary-900 via-primary-700 to-secondary-600",
    ];
    return gradients[hash % gradients.length];
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      
      {/* Theme-aligned hero header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-700 via-primary-600 to-secondary-500 text-white p-8 md:p-12 shadow-xl shadow-primary-700/20">
        {/* Glow Effects */}
        <div className="absolute -right-16 -top-20 h-80 w-80 rounded-full bg-white/15 blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-16 left-8 h-64 w-64 rounded-full bg-secondary-300/20 blur-2xl pointer-events-none"></div>

        <div className="relative z-10 max-w-3xl space-y-3">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Tutorials & Guides
            </h1>
            <p className="text-sm md:text-base leading-relaxed text-primary-50/95">
              Learn how to make the most of your family tree, manage profiles, and connect with your relatives.
            </p>
        </div>
      </div>

      {/* Filter Row: Segmented navigation */}
      <div className="flex flex-col gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
              {[
                { key: 'all', label: 'All', icon: <FiGrid size={14} /> },
                { key: 'video', label: 'Video Only', icon: <FiPlayCircle size={14} /> },
                { key: 'article', label: 'Article Only', icon: <FiBookOpen size={14} /> },
                { key: 'mixed', label: 'Mixed Content', icon: <FiLayers size={14} /> },
              ].map((item) => {
                const active = activeType === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleTypeSelect(item.key)}
                    className={[
                      'inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-xs font-semibold tracking-wide transition-all duration-200 shadow-sm',
                      active
                        ? 'bg-primary-700 text-white border-primary-700 shadow-primary-700/15'
                        : 'bg-white text-slate-600 border-slate-200/60 hover:border-primary-200 hover:bg-primary-50/40 hover:text-primary-700 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800',
                    ].join(' ')}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                );
              })}

            <div className="relative w-full sm:w-48 shrink-0">
              <select
                value={tutorialLang}
                onChange={(e) => {
                  const val = e.target.value;
                  setTutorialLang(val);
                  localStorage.setItem('tutorialLanguage', val);
                }}
                className="h-12 w-full rounded-2xl border-2 border-primary-500 bg-white px-3 text-sm font-bold text-slate-800 dark:text-slate-100 dark:bg-slate-900 outline-none transition focus:border-primary-600 focus:ring-4 focus:ring-primary-100 dark:focus:ring-primary-900/30 cursor-pointer shadow-sm"
                aria-label="Select tutorial language"
              >
                {tutorialLanguages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    🌐 {lang.label}
                  </option>
                ))}
              </select>
            </div>

            <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80 lg:w-96">
              <input
                type="text"
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                placeholder="Search tutorials..."
                className="h-12 w-full rounded-xl border-2 border-primary-500 bg-white py-3 pl-4 pr-20 text-sm font-medium text-slate-800 placeholder-slate-400 outline-none transition focus:border-primary-600 focus:ring-4 focus:ring-primary-100 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:ring-primary-900/30"
              />
              {qInput && (
                <button
                  type="button"
                  onClick={() => setQInput('')}
                  className="absolute right-11 top-1/2 -translate-y-1/2 rounded-full px-1.5 text-lg font-bold leading-none text-slate-300 hover:text-primary-700"
                  aria-label="Clear search"
                >
                  &times;
                </button>
              )}
              <button
                type="submit"
                className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg bg-primary-700 text-white transition hover:bg-primary-800"
                aria-label="Search tutorials"
              >
                <FiSearch size={14} />
              </button>
            </form>
          </div>

          <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider shrink-0 lg:pt-3">
            Found {total} {total === 1 ? 'tutorial' : 'tutorials'}
          </div>
        </div>
      </div>

      {/* Active filters status */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-500">
          <span className="font-semibold uppercase tracking-wider text-slate-400">Active:</span>
          {activeQ && (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-primary-50 dark:bg-primary-900/20 px-3 py-1.5 font-semibold text-primary-700 dark:text-primary-200 border border-primary-100 dark:border-primary-800/40 shadow-sm">
              Search: "{activeQ}"
              <button
                type="button"
                onClick={handleRemoveSearch}
                className="text-primary-400 hover:text-primary-700 font-bold"
              >
                &times;
              </button>
            </span>
          )}
          {activeType && activeType !== 'all' && (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-secondary-50 dark:bg-secondary-900/20 px-3 py-1.5 font-semibold text-secondary-700 dark:text-secondary-200 border border-secondary-100 dark:border-secondary-800/40 shadow-sm">
              Type: {activeType === 'video' ? 'Video' : activeType === 'article' ? 'Article' : 'Mixed'}
              <button
                type="button"
                onClick={() => handleRemoveFilter('type')}
                className="text-secondary-400 hover:text-secondary-700 font-bold"
              >
                &times;
              </button>
            </span>
          )}
          <button
            type="button"
            onClick={handleResetAll}
            className="text-xs font-bold text-rose-600 hover:text-rose-800 transition-colors py-1 px-2 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg"
          >
            Clear Filters
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
          {error}
        </div>
      )}

      {/* Main Grid View */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : rows.length === 0 ? (
        <div className="py-6 w-full">
          <EmptyState
            type="generic"
            title="No tutorials found"
            description="We couldn't find any tutorials matching your current search criteria or type filters."
            action={hasActiveFilters ? (
              <button
                type="button"
                onClick={handleResetAll}
                className="rounded-xl bg-primary-700 hover:bg-primary-800 text-white px-5 py-2 text-xs font-bold transition-all shadow"
              >
                Reset Filters & Search
              </button>
            ) : null}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {rows.map((tutorial) => {
            const hasVideo = tutorial.contentType === 'video' || tutorial.contentType === 'mixed';
            const isArticle = tutorial.contentType === 'article';
            const gradient = getGradientClass(tutorial.id, tutorial.title);
            
            return (
              <div
                key={tutorial.id}
                onClick={() => navigate(`/tutorials/${tutorial.id}`)}
                className="group relative flex flex-col justify-between rounded-3xl border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900 overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer transform-gpu isolate"
                style={{ WebkitMaskImage: '-webkit-radial-gradient(white, black)' }}
              >
                {/* Thumbnail block with overlay features */}
                <div className="relative aspect-[16/10] w-full bg-slate-50 dark:bg-slate-950 overflow-hidden rounded-t-3xl">
                  
                  {tutorial.thumbnailUrl ? (
                    <img
                      src={tutorial.thumbnailUrl}
                      alt={tutorial.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 rounded-t-3xl"
                      loading="lazy"
                    />
                  ) : (
                    // Beautiful gradient fallback overlay
                    <div className={`relative h-full w-full bg-gradient-to-br ${gradient} flex items-center justify-center p-6 text-center text-white overflow-hidden rounded-t-3xl`}>
                      {/* Grid overlay */}
                      <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] opacity-10"></div>
                      
                      {/* Watermark Icon */}
                      <div className="absolute -bottom-6 -right-6 text-white/5 pointer-events-none transition-transform duration-500 group-hover:scale-110">
                        {isArticle ? <FiBookOpen size={140} /> : <FiPlayCircle size={140} />}
                      </div>

                      <span className="font-extrabold text-sm tracking-wide text-white/95 leading-snug drop-shadow-md line-clamp-3">
                        {tutorial.title}
                      </span>
                    </div>
                  )}

                  {/* Format Indicator Badge */}
                  <span className="absolute top-4 right-4 p-2 rounded-xl bg-primary-700/85 dark:bg-slate-900/80 text-white backdrop-blur shadow-sm z-10 transition-transform duration-300 group-hover:scale-105">
                    {isArticle ? <FiBookOpen size={14} /> : <FiPlayCircle size={14} />}
                  </span>

                  {/* Category Badge */}
                  {tutorial.category && (
                    <span className="absolute top-4 left-4 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 shadow-sm border border-slate-100/30 z-10">
                      {tutorial.category}
                    </span>
                  )}

                  {/* Play/Read Overlay on Hover */}
                  <div className="absolute inset-0 bg-primary-700/25 backdrop-blur-[2px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-t-3xl">
                    <div className="rounded-full bg-white text-primary-700 p-3.5 shadow-xl transform scale-75 group-hover:scale-100 transition-transform duration-300">
                      {hasVideo ? (
                        <svg className="h-6 w-6 text-primary-700" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      ) : (
                        <svg className="h-6 w-6 text-primary-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      )}
                    </div>
                  </div>

                  {/* Duration overlay badge */}
                  {hasVideo && tutorial.videoDuration && (
                    <div className="absolute right-4 bottom-4 rounded-lg bg-slate-950/80 backdrop-blur px-2 py-1 text-[10px] font-bold text-white flex items-center gap-1 shadow-sm border border-white/5">
                      <FiClock size={11} />
                      {tutorial.videoDuration}
                    </div>
                  )}
                </div>

                {/* Card Meta Content */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4 rounded-b-3xl">
                  <div className="space-y-2">
                    <h3 className="font-bold text-slate-800 dark:text-slate-50 text-base leading-snug break-words group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors">
                      {tutorial.title}
                    </h3>
                    
                    {tutorial.shortDescription && (
                      <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed line-clamp-2 break-words">
                        {tutorial.shortDescription}
                      </p>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="flex items-center justify-between border-t border-slate-50 dark:border-slate-800/60 pt-3">
                    {tutorial.publishDate ? (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold tracking-wide inline-flex items-center gap-1">
                        <FiCalendar size={11} />
                        {new Date(tutorial.publishDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    ) : (
                      <span></span>
                    )}

                    <span className="text-xs font-bold text-primary-700 dark:text-primary-300 inline-flex items-center gap-0.5 opacity-0 md:opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                      Learn More <FiArrowRight size={12} />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination control */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900 px-6 py-4 rounded-3xl shadow-sm">
          <div className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">
            Page {page} of {totalPages} ({total} total)
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
              onClick={() => updateParams({ page: Math.max(1, page - 1) })}
              disabled={loading || page <= 1}
            >
              Prev
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
              onClick={() => updateParams({ page: Math.min(totalPages, page + 1) })}
              disabled={loading || page >= totalPages}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
