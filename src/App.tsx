import { useEffect, useState } from "react";
import {
  FaBookOpen,
  FaGithub,
  FaHome,
  FaRss,
  FaTelegramPlane,
  FaTwitter,
} from "react-icons/fa";

type Language = "en" | "zh";
type FeedState = "loading" | "ready" | "error";

type Post = {
  title: string;
  url: string;
  date: string;
  summary: string;
};

const BLOG_URL = "https://blog.sanae.im";
const BLOG_FEED_URL = `${BLOG_URL}/index.xml`;

const copy = {
  en: {
    greeting: "Hello, I'm",
    iAmTitle: "I am",
    iAmItems: [
      "Bilingual in Mandarin and English, planning to learn Japanese.",
      "Transgender as Non-binary.",
      "An undergraduate student studying Computer Science.",
      "Still learning to build things, following Artificial Intelligence.",
    ],
    aboutTitle: "About me",
    aboutParagraphs: [
      "Name from Sanae Kochiya -- Touhou Project, who can keep her power to cause miracles as a small personal wish.",
      "Outside of Computer Science, I spend my curiosity on RTS games like StarCraft2, technical Japanese mahjong, and Rhythm game maimaiDX and CHUNITHM.",
      "Hope to stay kind, be useful to others, and find small miracles in ordinary days.",
    ],
    writingsTitle: "Recent Posts",
    writingsIntroPrefix: "Notes published on ",
    writingsIntroLink: "Blog",
    writingsIntroSuffix: "",
    loadingPosts: "Refreshing from the blog…",
    postsUnavailable:
      "The blog feed is not available yet. You can still visit the blog directly.",
    noPosts: "No published posts were found in the blog feed.",
    visitBlog: "Visit blog",
    subscribe: "Subscribe",
    avatarAlt: "Sanae's avatar",
  },
  zh: {
    greeting: "你好，我是",
    iAmTitle: "我是",
    iAmItems: [
      "使用中文和英文，计划学习日语。",
      "计算机科学专业本科生。",
      "仍在学习创造事物，关注人工智能。",
    ],
    aboutTitle: "关于我",
    aboutParagraphs: [
      "名字来自东方 Project 中的东风谷早苗，也将“引发奇迹”的能力当作一个小小愿望。",
      "除计算机科学外，我还喜欢《星际争霸 2》等 RTS 游戏、技术向日麻，以及音游 maimaiDX 和 CHUNITHM。",
      "希望自己始终友好、能够帮助到别人，也能在平凡日常里找到一些奇迹。",
    ],
    writingsTitle: "最近文章",
    writingsIntroPrefix: "发布在 ",
    writingsIntroLink: "Blog",
    writingsIntroSuffix: " 的文章",
    loadingPosts: "正在从博客刷新文章…",
    postsUnavailable: "博客 Feed 暂时不可用，你仍然可以直接访问博客。",
    noPosts: "博客 Feed 中暂时没有已发布的文章。",
    visitBlog: "访问博客",
    subscribe: "订阅 RSS",
    avatarAlt: "Sanae 的头像",
  },
} as const;

const onlineLinks = [
  {
    name: "GitHub",
    href: "https://github.com/isanae1",
    handle: "@isanae1",
    icon: FaGithub,
    iconClass: "github-icon",
  },
  {
    name: "Telegram",
    href: "https://t.me/iSanae1",
    handle: "@iSanae1",
    icon: FaTelegramPlane,
    iconClass: "telegram-icon",
  },
  {
    name: "Twitter",
    href: "https://x.com/iSanae233",
    handle: "@iSanae233",
    icon: FaTwitter,
    iconClass: "twitter-icon",
  },
] as const;

function getInitialLanguage(): Language {
  const stored = window.localStorage.getItem("sanae-language");
  if (stored === "en" || stored === "zh") return stored;

  const browserLanguages = [
    ...(window.navigator.languages ?? []),
    window.navigator.language,
  ].filter(Boolean);
  const hasChineseLanguage = browserLanguages.some((language) =>
    /^zh(?:-|$)/i.test(language),
  );
  const hasChineseUserAgent =
    /(?:^|[;,\s(])zh(?:[-_][a-z]{2})?(?:$|[;,\s)])/i.test(
      window.navigator.userAgent,
    );

  return hasChineseLanguage || hasChineseUserAgent ? "zh" : "en";
}

function textFromMarkup(value: string): string {
  const document = new DOMParser().parseFromString(value, "text/html");
  return (document.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

function safePostUrl(value: string): string {
  try {
    const url = new URL(value, BLOG_URL);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : BLOG_URL;
  } catch {
    return BLOG_URL;
  }
}

function firstText(element: Element, selectors: string[]): string {
  for (const selector of selectors) {
    const value = element.querySelector(selector)?.textContent?.trim();
    if (value) return value;
  }

  return "";
}

function parseFeed(source: string): Post[] {
  const xml = new DOMParser().parseFromString(source, "application/xml");
  if (xml.querySelector("parsererror")) return [];

  return Array.from(xml.querySelectorAll("item, entry"))
    .slice(0, 12)
    .map((entry) => {
      const linkElement =
        entry.querySelector('link[rel="alternate"]') ??
        entry.querySelector("link");
      const link =
        linkElement?.getAttribute("href") ??
        linkElement?.textContent?.trim() ??
        firstText(entry, ["guid", "id"]);

      return {
        title: textFromMarkup(firstText(entry, ["title"])) || "Untitled",
        url: safePostUrl(link),
        date: firstText(entry, ["pubDate", "published", "updated", "date"]),
        summary: textFromMarkup(
          firstText(entry, ["description", "summary", "content"]),
        ).slice(0, 220),
      };
    });
}

function formatPostDate(value: string, language: Language) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return {
    dateTime: date.toISOString(),
    label: new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date),
  };
}

export default function App() {
  const [language, setLanguage] = useState<Language>(getInitialLanguage);
  const [posts, setPosts] = useState<Post[]>([]);
  const [feedState, setFeedState] = useState<FeedState>("loading");
  const page = /^\/writings(?:\/|$)/.test(window.location.pathname)
    ? "writings"
    : "home";
  const text = copy[language];

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    document.title =
      page === "writings"
        ? `${text.writingsTitle} — Sanae`
        : "Sanae — Personal Homepage";
    window.localStorage.setItem("sanae-language", language);
  }, [language, page, text.writingsTitle]);

  useEffect(() => {
    if (page !== "writings") return;

    const controller = new AbortController();

    fetch(BLOG_FEED_URL, {
      cache: "no-cache",
      headers: { Accept: "application/xml, text/xml" },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Feed unavailable");
        const nextPosts = parseFeed(await response.text());
        setPosts(nextPosts);
        setFeedState("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setFeedState("error");
      });

    return () => controller.abort();
  }, [page]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-profile">
          <strong>Sanae</strong>
        </div>

        <nav className="sidebar-nav" aria-label="Primary navigation">
          <div className="nav-group">
            <a
              className={`nav-link ${page === "home" ? "active" : ""}`}
              href="/"
              aria-current={page === "home" ? "page" : undefined}
            >
              <FaHome aria-hidden="true" />
              <span>Home</span>
            </a>
            <a
              className={`nav-link ${page === "writings" ? "active" : ""}`}
              href="/writings/"
              aria-current={page === "writings" ? "page" : undefined}
            >
              <FaBookOpen aria-hidden="true" />
              <span>Writings</span>
            </a>
          </div>

          <div className="nav-group online-group">
            <h2>Online</h2>
            {onlineLinks.map((link) => {
              const Icon = link.icon;

              return (
                <a
                  key={link.name}
                  className="nav-link online-link"
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${link.name}: ${link.handle}`}
                >
                  <Icon className={link.iconClass} aria-hidden="true" />
                  <span>{link.name}</span>
                  <span className="external-arrow" aria-hidden="true">
                    ↗
                  </span>
                </a>
              );
            })}
          </div>
        </nav>

        <div className="sidebar-footer">
          <span>
            © {new Date().getFullYear()}{" "}
            <a href="mailto:hi@sanae.im" aria-label="Contact Sanae">
              Sanae
            </a>
          </span>
          <span>All rights reserved.</span>
        </div>
      </aside>

      <div className="content-shell">
        <header className="page-header">
          <h2>{page === "writings" ? "Recent Posts" : "Home"}</h2>
          <div className="language-switch" aria-label="Language">
            <button
              type="button"
              aria-pressed={language === "en"}
              onClick={() => setLanguage("en")}
            >
              Eng
            </button>
            <span aria-hidden="true">/</span>
            <button
              type="button"
              aria-pressed={language === "zh"}
              onClick={() => setLanguage("zh")}
            >
              中文
            </button>
          </div>
        </header>

        {page === "home" ? (
          <main className="page-content">
            <section className="hero" aria-labelledby="home-title">
              <div>
                <h1 id="home-title">
                  {text.greeting}
                  <br />
                  <span className="hero-name-line">
                    <span>
                      <mark>Sanae</mark>
                      <span className="accent-dot">.</span>
                    </span>
                    <span
                      className="hero-pronunciation"
                      aria-label="Pronunciation"
                    >
                      /'sɑːnɑːeɪ/
                    </span>
                  </span>
                </h1>
                <div className="hero-links" aria-label="Online profiles">
                  {onlineLinks.map((link) => {
                    const Icon = link.icon;

                    return (
                      <a
                        key={link.name}
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Icon className={link.iconClass} aria-hidden="true" />
                        <span>{link.name}</span>
                      </a>
                    );
                  })}
                </div>
              </div>

              <div className="portrait-wrap">
                <img
                  src="/twitter-avatar.jpg"
                  width="400"
                  height="400"
                  alt={text.avatarAlt}
                />
              </div>
            </section>

            <section className="detail-section">
              <h2>{text.iAmTitle}</h2>
              <div className="detail-copy">
                {text.iAmItems.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            </section>

            <section className="detail-section">
              <h2>{text.aboutTitle}</h2>
              <div className="detail-copy">
                {text.aboutParagraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          </main>
        ) : (
          <main className="page-content writings-content">
            <section className="writings-hero">
              <p className="writings-intro">
                {text.writingsIntroPrefix}
                <a
                  className="writings-intro-link"
                  href={BLOG_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  {text.writingsIntroLink}
                </a>
                {text.writingsIntroSuffix}
              </p>
              <div className="writings-actions">
                <a
                  className="blog-button"
                  href={BLOG_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span>{text.visitBlog}</span>
                  <span aria-hidden="true">↗</span>
                </a>
                <a
                  className="blog-button rss-button"
                  href={BLOG_FEED_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  <FaRss aria-hidden="true" />
                  <span>{text.subscribe}</span>
                </a>
              </div>
            </section>

            <section className="posts-section" aria-live="polite">
              {feedState === "loading" && (
                <>
                  <p className="posts-status">{text.loadingPosts}</p>
                  <div className="post-skeletons" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                </>
              )}

              {feedState === "error" && (
                <div className="feed-message">
                  <p>{text.postsUnavailable}</p>
                  <a href={BLOG_URL} target="_blank" rel="noreferrer">
                    {text.visitBlog} ↗
                  </a>
                </div>
              )}

              {feedState === "ready" && posts.length === 0 && (
                <div className="feed-message">
                  <p>{text.noPosts}</p>
                  <a href={BLOG_URL} target="_blank" rel="noreferrer">
                    {text.visitBlog} ↗
                  </a>
                </div>
              )}

              {feedState === "ready" && posts.length > 0 && (
                <div className="post-list">
                  {posts.map((post) => {
                    const date = formatPostDate(post.date, language);

                    return (
                      <a
                        className="post-link"
                        href={post.url}
                        key={`${post.url}-${post.date}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <time dateTime={date?.dateTime}>{date?.label}</time>
                        <span className="post-copy">
                          <strong>{post.title}</strong>
                          {post.summary && <small>{post.summary}</small>}
                        </span>
                        <span className="post-arrow" aria-hidden="true">
                          ↗
                        </span>
                      </a>
                    );
                  })}
                </div>
              )}
            </section>
          </main>
        )}
      </div>
    </div>
  );
}
