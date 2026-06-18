import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { fetchTutorialById, fetchTutorials, fetchTutorialLanguages } from '../services/tutorial.service';
import { useNetwork } from '../Contexts/NetworkContext';
import { useLanguage } from '../Contexts/LanguageContext';

import {
  FiAlertTriangle,
  FiArrowLeft,
  FiArrowRight,
  FiBook,
  FiCalendar,
  FiChevronRight,
  FiClock,
  FiHelpCircle,
} from 'react-icons/fi';

function getYouTubeId(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

export default function TutorialDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { isOffline } = useNetwork();


  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tutorial, setTutorial] = useState(null);
  const [siblings, setSiblings] = useState([]);
  const [retryKey, setRetryKey] = useState(0);

  const { language: globalLanguage } = useLanguage();
  const [tutorialLang, setTutorialLang] = useState(() => {
    return localStorage.getItem('tutorialLanguage') || globalLanguage || 'english';
  });

  useEffect(() => {
    if (!localStorage.getItem('tutorialLanguage') && globalLanguage) {
      setTutorialLang(globalLanguage);
    }
  }, [globalLanguage]);

  useEffect(() => {
    let alive = true;

    async function loadDetail() {
      setLoading(true);
      setError('');
      try {
        const res = await fetchTutorialById(id, tutorialLang);
        if (!alive) return;
        if (!res) throw new Error('No data returned from backend.');
        setTutorial(res);
      } catch (e) {
        if (!alive) return;
        setError(e?.message || 'Failed to fetch tutorial details.');
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    if (!isOffline) {
      loadDetail();
    } else {
      setLoading(false);
    }

    return () => {
      alive = false;
    };
  }, [id, retryKey, isOffline, tutorialLang]);

  useEffect(() => {
    let alive = true;

    async function loadSiblings() {
      try {
        const res = await fetchTutorials({ page: 1, limit: 100 });
        if (alive && res && Array.isArray(res.data)) {
          setSiblings(res.data);
        }
      } catch {
        // Previous/next links are helpful, but they should never block the tutorial.
      }
    }

    loadSiblings();

    return () => {
      alive = false;
    };
  }, []);

  const { prevTutorial, nextTutorial } = useMemo(() => {
    if (siblings.length === 0 || !id) return { prevTutorial: null, nextTutorial: null };
    const currentIndex = siblings.findIndex((t) => String(t.id) === String(id));
    if (currentIndex === -1) return { prevTutorial: null, nextTutorial: null };

    return {
      prevTutorial: currentIndex > 0 ? siblings[currentIndex - 1] : null,
      nextTutorial: currentIndex < siblings.length - 1 ? siblings[currentIndex + 1] : null,
    };
  }, [siblings, id]);

  const handleRetry = () => {
    setRetryKey((k) => k + 1);
  };

  if (isOffline || error) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-5">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400 border border-red-100 dark:border-red-900/30 shadow-sm">
          <FiAlertTriangle size={24} />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
          {isOffline ? 'You are offline' : 'Failed to load tutorial'}
        </h2>
        <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
          {isOffline
            ? 'Please check your internet connection and try again.'
            : error || 'An unexpected error occurred while loading this tutorial.'}
        </p>
        <button
          type="button"
          onClick={handleRetry}
          className="rounded-xl bg-primary-700 px-5 py-2.5 text-xs font-bold text-white hover:bg-primary-800 transition-all shadow-md"
        >
          Retry
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center text-gray-500 space-y-3">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-700 mb-2"></div>
        <p className="font-semibold text-xs tracking-wider uppercase text-slate-400">Loading tutorial...</p>
      </div>
    );
  }

  if (!tutorial) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center text-gray-500 flex flex-col items-center gap-3">
        <FiHelpCircle size={36} className="text-slate-400" />
        <p className="font-bold text-sm">Tutorial not found</p>
      </div>
    );
  }

  const hasVideo = tutorial.contentType === 'video' || tutorial.contentType === 'mixed';
  const hasText = tutorial.contentType === 'article' || tutorial.contentType === 'mixed';
  const ytVideoId = hasVideo ? getYouTubeId(tutorial.videoUrl) : null;
  const sections = Array.isArray(tutorial.content?.sections) ? tutorial.content.sections : [];
  const contentTypeLabel = hasVideo ? (hasText ? 'Mixed Content' : 'Video Tutorial') : 'Article Tutorial';
  const publishDateLabel = tutorial.publishDate
    ? new Date(tutorial.publishDate).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  const contentColumn = (
    <article className="rounded-[30px] border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7 lg:p-8">
      <div className="flex flex-wrap items-center gap-2">
        {tutorial.category ? (
          <span className="rounded-full bg-primary-50 px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-primary-700 dark:bg-primary-500/10 dark:text-primary-200">
            {tutorial.category}
          </span>
        ) : null}
        <span className="rounded-full bg-secondary-50 px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-secondary-700 dark:bg-secondary-500/10 dark:text-secondary-200">
          {contentTypeLabel}
        </span>
      </div>

      <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-slate-900 dark:text-slate-50 md:text-4xl">
        {tutorial.title}
      </h1>

      {tutorial.shortDescription ? (
        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300 md:text-base">
          {tutorial.shortDescription}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-4 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
        {hasVideo && tutorial.videoDuration ? (
          <span className="flex items-center gap-1.5 text-primary-700 dark:text-primary-300">
            <FiClock size={13} /> {tutorial.videoDuration}
          </span>
        ) : null}
        {publishDateLabel ? (
          <span className="flex items-center gap-1.5">
            <FiCalendar size={13} /> Published: {publishDateLabel}
          </span>
        ) : null}
      </div>

      {hasText && sections.length > 0 ? (
        <div className="mt-8 space-y-8">
          {sections.map((sec, sectionIndex) => {
            const sectionId = sec.id ?? sectionIndex;
            const subSections = Array.isArray(sec.subSections) ? sec.subSections : [];

            return (
              <section key={sectionId} className="border-t border-slate-100 pt-7 dark:border-slate-800">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary-600 dark:text-primary-300">
                  Section {sectionIndex + 1}
                </span>
                <h2 className="mt-2 text-xl font-extrabold text-slate-900 dark:text-slate-50">
                  {sec.heading}
                </h2>

                {sec.content ? (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600 dark:text-slate-300">
                    {sec.content}
                  </p>
                ) : null}

                {subSections.length > 0 ? (
                  <div className="mt-5 space-y-5">
                    {subSections.map((sub, subIndex) => {
                      const subId = sub.id ?? `${sectionId}-${subIndex}`;

                      return (
                        <div key={subId} className="border-l-2 border-primary-100 pl-4 dark:border-slate-700">
                          <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                            {sub.subTopic}
                          </h3>
                          {sub.content ? (
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-600 dark:text-slate-300">
                              {sub.content}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      ) : hasText ? (
        <p className="mt-8 border-t border-slate-100 pt-6 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
          Written content has not been added for this tutorial yet.
        </p>
      ) : null}

      {tutorial.description ? (
        <section className="mt-8 border-t border-slate-100 pt-7 dark:border-slate-800">
          <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-secondary-700 dark:text-secondary-200">
            About this tutorial
          </h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600 dark:text-slate-300">
            {tutorial.description}
          </p>
        </section>
      ) : null}
    </article>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50/60 via-white to-secondary-50/40 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 dark:border-slate-800/60 pb-3">
          <nav className="flex items-center gap-2 overflow-x-auto whitespace-nowrap text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            <button
              type="button"
              onClick={() => navigate('/tutorials')}
              className="flex items-center gap-1 transition-colors hover:text-primary-700 dark:hover:text-primary-300"
            >
              <FiBook size={12} /> Tutorials
            </button>
            <FiChevronRight size={10} className="text-slate-300 dark:text-slate-700" />
            {tutorial.category ? (
              <>
                <span className="text-slate-500 dark:text-slate-400">{tutorial.category}</span>
                <FiChevronRight size={10} className="text-slate-300 dark:text-slate-700" />
              </>
            ) : null}
            <span className="max-w-[220px] truncate text-primary-700 dark:text-primary-300">
              {tutorial.title}
            </span>
          </nav>

        </div>

        {hasVideo ? (
          <div className="grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,1.1fr)_minmax(380px,0.9fr)] lg:items-start">
            <aside className="lg:sticky lg:top-24">
              {ytVideoId ? (
                <div className="overflow-hidden rounded-[24px] bg-slate-950 shadow-2xl shadow-primary-900/20">
                  <div className="aspect-video w-full">
                    <iframe
                      src={`https://www.youtube.com/embed/${ytVideoId}`}
                      title={tutorial.title}
                      className="h-full w-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    ></iframe>
                  </div>
                </div>
              ) : (
                <div className="flex aspect-video flex-col items-center justify-center rounded-[24px] border border-dashed border-primary-200 bg-white/80 p-6 text-center text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <FiAlertTriangle className="mb-3 text-secondary-500" size={34} />
                  <span className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
                    Cannot load video player
                  </span>
                  <span className="mt-2 max-w-sm break-all text-xs text-slate-500 dark:text-slate-400">
                    {tutorial.videoUrl || 'Invalid URL'}
                  </span>
                </div>
              )}
            </aside>

            <main>{contentColumn}</main>
          </div>
        ) : (
          <main className="mx-auto max-w-3xl">{contentColumn}</main>
        )}

        {(prevTutorial || nextTutorial) && (
          <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 text-sm font-bold dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            {prevTutorial ? (
              <Link
                to={`/tutorials/${prevTutorial.id}`}
                className="inline-flex min-w-0 items-center gap-2 text-slate-500 transition hover:text-primary-700 dark:text-slate-400 dark:hover:text-primary-300"
              >
                <FiArrowLeft size={15} />
                <span className="truncate">Previous: {prevTutorial.title}</span>
              </Link>
            ) : (
              <span></span>
            )}

            {nextTutorial ? (
              <Link
                to={`/tutorials/${nextTutorial.id}`}
                className="inline-flex min-w-0 items-center gap-2 text-slate-500 transition hover:text-primary-700 dark:text-slate-400 dark:hover:text-primary-300 sm:text-right"
              >
                <span className="truncate">Next: {nextTutorial.title}</span>
                <FiArrowRight size={15} />
              </Link>
            ) : (
              <span></span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
