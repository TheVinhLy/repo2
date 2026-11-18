// =============================================================================
// VAAPP Plugin: PornDos  (https://www.porndos.com)
// Author: TheVinhLy  |  Version: 1.0.4
// Luồng lấy link:
//   1. parseMovieDetail → lấy video_id số (vd "9456"), set episode.id = slug|data:9456
//   2. getUrlDetail(slug, datasend="9456") → trả URL embed: /embed/9456/
//   3. App fetch embed page (HTML nhỏ ~1KB)
//   4. parseDetailResponse → parse "file:\"https://cdn/okhls/ID//master.m3u8\""
// =============================================================================

var BASE = "https://www.porndos.com";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
function absUrl(u) {
    if (!u) return "";
    u = String(u).replace(/&amp;/g, "&").replace(/\\\//g, "/").trim();
    if (u.indexOf("//") === 0) return "https:" + u;
    if (u.indexOf("http") === 0) return u;
    if (u.charAt(0) === "/") return BASE + u;
    return BASE + "/" + u;
}

function decodeHtml(s) {
    return String(s || "")
        .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
        .replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

// "/video/slug-name_v123/" → "slug-name_v123"
function pathToSlug(href) {
    var m = String(href).match(/\/video\/([^"'?#|\s\/]+)/i);
    return m ? m[1] : "";
}

function pageFromUrl(url) {
    url = String(url || "").split("|")[0];
    var m = url.match(/\/(\d+)\/?$/) || url.match(/[?&]page=(\d+)/i);
    return m ? parseInt(m[1], 10) : 1;
}

function buildPagedUrl(base, page) {
    base = String(base).replace(/\/\d+\/?$/, "").replace(/\/$/, "");
    return page > 1 ? base + "/" + page + "/" : base + "/";
}

// =============================================================================
// NHÓM 1: CẤU HÌNH
// =============================================================================
function getManifest() {
    return JSON.stringify({
        "id": "porndos",
        "name": "PornDos",
        "version": "1.0.4",
        "description": "Free HD Porn Videos từ porndos.com",
        "author": "TheVinhLy",
        "baseUrl": "https://www.porndos.com",
        "iconUrl": "https://raw.githubusercontent.com/TheVinhLy/repo/main/plugins/porndos.ico",
        "referrer": "https://www.porndos.com/",
        "isEnabled": true,
        "isAdult": true,
        "type": "MOVIE",
        "layoutType": "HORIZONTAL",
        "playerType": "exoplayer",
        "adblock": true,
        "debug": false
    });
}

function getHomeSections() {
    return JSON.stringify([
        { slug: "home",           title: "Mới Nhất",     type: "Horizontal", path: "" },
        { slug: "videos_70",      title: "Tất Cả Video", type: "Horizontal", path: "" },
        { slug: "most-viewed_83", title: "Xem Nhiều",    type: "Horizontal", path: "" },
        { slug: "top-rated_52",   title: "Đánh Giá Cao", type: "Horizontal", path: "" }
    ]);
}

function getPrimaryCategories() {
    return JSON.stringify([
        { name: "Mới Nhất",       slug: "home" },
        { name: "Tất Cả Video",   slug: "videos_70" },
        { name: "Xem Nhiều",      slug: "most-viewed_83" },
        { name: "Đánh Giá Cao",   slug: "top-rated_52" },
        { name: "Thể Loại",       slug: "categories_84" },
        { name: "Diễn Viên",      slug: "pornstars_42" },
        { name: "Studios",        slug: "studios_91" }
    ]);
}

function getFilterConfig() {
    return JSON.stringify({ sort: [], category: [] });
}

// =============================================================================
// NHÓM 2: SINH URL
// =============================================================================
function getUrlList(slug, filtersJson) {
    var filters = JSON.parse(filtersJson || "{}");
    var page = filters.page || 1;
    slug = String(slug || "home").split("|")[0].replace(/^\/+|\/+$/g, "");

    if (slug === "home" || slug === "") {
        return page > 1 ? BASE + "/" + page + "/" : BASE + "/";
    }
    return buildPagedUrl(BASE + "/" + slug, page);
}

function getUrlSearch(keyword, filtersJson) {
    var page = JSON.parse(filtersJson || "{}").page || 1;
    var kw = encodeURIComponent(String(keyword || "").trim()).replace(/%20/g, "+");
    return buildPagedUrl(BASE + "/search/" + kw, page);
}

/**
 * Nhận slug = "slug-name_v123" hoặc URL đầy đủ.
 * datasend = video_id số (vd "9456") do parseMovieDetail gắn vào.
 *
 * → Nếu có datasend (video_id số): trả URL embed page /embed/{id}/
 *   App fetch embed page → parseDetailResponse lấy m3u8 thật
 * → Fallback: trả URL trang chi tiết video để parseDetailResponse xử lý
 */
function getUrlDetail(slug, datasend) {
    if (!slug) return "";
    slug = String(slug).split("|")[0];

    // datasend là video_id số -> trả embed URL
    if (datasend && /^\d+$/.test(String(datasend).trim())) {
        var vid = String(datasend).trim();
        console.log("getUrlDetail: embed URL /embed/" + vid + "/");
        return BASE + "/embed/" + vid + "/";
    }

    // Fallback
    if (slug.indexOf("http") === 0) return slug;
    slug = slug.replace(/^\/+/, "").replace(/^video\//, "");
    return BASE + "/video/" + slug + "/";
}

function getUrlCategories() { return BASE + "/categories_84/"; }
function getUrlCountries()  { return ""; }
function getUrlYears()      { return ""; }

// =============================================================================
// NHÓM 3: PARSER
// =============================================================================

function parseListResponse(html, apiUrl) {
    var empty = JSON.stringify({ items: [], pagination: { currentPage: 1, totalPages: 1 } });
    try {
        html = String(html || "");
        var url = String(apiUrl || "");
        var items = [];
        var seen = {};
        var m;

        // ---- Trang Categories ----
        if (/\/categories_?84/i.test(url) && !/\/category\//i.test(url)) {
            var catRe = /<a\s+href="(https?:\/\/www\.porndos\.com\/category\/[^"]+)"[^>]*>\s*<img[^>]+(?:data-src|src)="([^"]+)"[^>]+alt="([^"]+)"/gi;
            while ((m = catRe.exec(html)) !== null) {
                var cSlug = m[1].replace(BASE, "").replace(/^\/|\/$/g, "");
                if (!cSlug || seen[cSlug]) continue;
                seen[cSlug] = true;
                items.push({ id: cSlug, title: decodeHtml(m[3]), posterUrl: absUrl(m[2]), quality: "CAT" });
            }
            return JSON.stringify({ items: items, pagination: { currentPage: 1, totalPages: 1 } });
        }

        // ---- Trang Pornstars ----
        if (/\/pornstars/i.test(url)) {
            var psRe = /<a\s+href="(https?:\/\/www\.porndos\.com\/pornstar\/[^"]+)"[^>]*>\s*<img[^>]+(?:data-src|src)="([^"]+)"[^>]+alt="([^"]+)"/gi;
            while ((m = psRe.exec(html)) !== null) {
                var psSlug = m[1].replace(BASE, "").replace(/^\/|\/$/g, "");
                if (!psSlug || seen[psSlug]) continue;
                seen[psSlug] = true;
                items.push({ id: psSlug, title: decodeHtml(m[3]), posterUrl: absUrl(m[2]), quality: "ACTRESS" });
            }
            return JSON.stringify({ items: items, pagination: { currentPage: pageFromUrl(url), totalPages: 999 } });
        }

        // ---- Trang Studios ----
        if (/\/studios/i.test(url)) {
            var stRe = /<a\s+href="(https?:\/\/www\.porndos\.com\/studio\/[^"]+)"[^>]*>\s*<img[^>]+(?:data-src|src)="([^"]+)"[^>]+alt="([^"]+)"/gi;
            while ((m = stRe.exec(html)) !== null) {
                var stSlug = m[1].replace(BASE, "").replace(/^\/|\/$/g, "");
                if (!stSlug || seen[stSlug]) continue;
                seen[stSlug] = true;
                items.push({ id: stSlug, title: decodeHtml(m[3]), posterUrl: absUrl(m[2]), quality: "CAT" });
            }
            return JSON.stringify({ items: items, pagination: { currentPage: 1, totalPages: 1 } });
        }

        // ---- Danh sách video ----
        // Cấu trúc: <div class="item" ...><a href="/video/SLUG/"><img data-src="..." alt="TITLE">
        var blocks = html.split(/<div\s+class="item"/i);
        blocks.shift();

        for (var i = 0; i < blocks.length; i++) {
            var b = blocks[i];

            var hm = b.match(/href="(https?:\/\/www\.porndos\.com\/video\/[^"]+)"/i);
            if (!hm) continue;
            var slug = pathToSlug(hm[1]);
            if (!slug || seen[slug]) continue;

            var im = b.match(/(?:data-src|src)="(\/images\/thumb\/[^"]+)"/i);
            var tm = b.match(/alt="([^"]+)"/i);

            // Duration: <span class="right"><i ...></i> MM:SS</span>
            var dur = "";
            var durM = b.match(/<span[^>]*class="right"[^>]*>[\s\S]*?(\d{1,2}:\d{2}(?::\d{2})?)/i);
            if (durM) dur = durM[1];

            seen[slug] = true;
            items.push({
                id: slug,
                title: tm ? decodeHtml(tm[1]) : slug.replace(/_v\d+$/, "").replace(/-/g, " "),
                posterUrl: im ? absUrl(im[1]) : "",
                description: dur,
                quality: "HD"
            });
        }

        // Phân trang
        var current = pageFromUrl(url);
        var total = current;
        var pageRe = /href="[^"]*\/(\d+)\/"[^>]*title="Page \d+"/gi;
        var pm;
        while ((pm = pageRe.exec(html)) !== null) {
            var n = parseInt(pm[1], 10);
            if (n < 10000 && n > total) total = n;
        }

        return JSON.stringify({ items: items, pagination: { currentPage: current, totalPages: total } });
    } catch (e) {
        console.log("parseListResponse lỗi: " + e);
        return empty;
    }
}

function parseSearchResponse(html, apiUrl) {
    return parseListResponse(html, apiUrl);
}

/**
 * Parse trang chi tiết video.
 * KEY: lấy video_id số từ flashvars (vd video_id: '9456')
 * Gán vào episode.datasend để getUrlDetail biết gọi /embed/{id}/
 */
function parseMovieDetail(html, apiUrl, datasend) {
    html = String(html || "");

    var id = pathToSlug(apiUrl || "");
    if (!id) {
        var c = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i);
        if (c) id = pathToSlug(c[1]);
    }

    // video_id số (dùng để build embed URL)
    var vidIdMatch = html.match(/video_id:\s*'(\d+)'/i);
    var vidId = vidIdMatch ? vidIdMatch[1] : "";
    console.log("parseMovieDetail: id=" + id + " vidId=" + vidId);

    // Title
    var t = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
        || html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
    var title = t ? decodeHtml(t[1]) : "Video";

    // Poster
    var p = html.match(/<link[^>]+fetchpriority="high"[^>]+href="([^"]+\.webp)"/i)
        || html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)
        || html.match(/preview_url:\s*'([^']+)'/i);
    var poster = p ? absUrl(p[1]) : "";

    // Description
    var d = html.match(/<meta[^>]+itemprop="description"[^>]+content="([^"]*)"/i)
        || html.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i);

    // Duration
    var dur = html.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);

    // Categories
    var cats = [];
    var seenC = {};
    var catRe = /href="(https?:\/\/www\.porndos\.com\/category\/([^"\/]+)\/?)"[^>]*>[\s\S]*?<\/a>/gi;
    var cm;
    while ((cm = catRe.exec(html)) !== null) {
        var catSlug = cm[1].replace(BASE, "").replace(/^\/|\/$/g, "");
        // Lấy text (bỏ tag)
        var nameRaw = cm[0].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        var nameStr = nameRaw.split(/\s+/).filter(function(w){ return w.length > 1; }).join(" ").trim();
        if (nameStr && !seenC[catSlug] && catSlug) {
            seenC[catSlug] = true;
            cats.push("[" + nameStr + "](" + catSlug + ")");
        }
    }
    // Fallback: video_categories trong flashvars
    if (cats.length === 0) {
        var vcMatch = html.match(/video_categories:\s*'([^']+)'/i);
        if (vcMatch) {
            vcMatch[1].split(",").forEach(function(c) {
                c = c.trim(); if (c) cats.push(c);
            });
        }
    }

    // Pornstars
    var casts = [];
    var seenA = {};
    var castRe = /href="(https?:\/\/www\.porndos\.com\/pornstar\/([^"\/]+)\/?)"[^>]*>[\s\S]*?<\/a>/gi;
    var am;
    while ((am = castRe.exec(html)) !== null) {
        var psSlug = am[1].replace(BASE, "").replace(/^\/|\/$/g, "");
        var pNameRaw = am[0].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        var pName = pNameRaw.split(/\s+/).filter(function(w){ return w.length > 1; }).join(" ").trim();
        if (pName && !seenA[psSlug] && psSlug) {
            seenA[psSlug] = true;
            casts.push("[" + pName + "](" + psSlug + ")");
        }
    }

    // Nếu có vidId → episode dùng datasend để truyền qua getUrlDetail → /embed/{id}/
    // Nếu không có vidId → fallback: episode.id = trang chi tiết, parseDetailResponse tự xử lý
    var episodeId, episodeDatasend;
    if (vidId) {
        episodeId = id;          // slug trang video (để getUrlDetail nhận slug, datasend=vidId)
        episodeDatasend = vidId; // video_id số
    } else {
        // Không có vidId → dùng URL trang chi tiết, parseDetailResponse sẽ parse lại
        episodeId = BASE + "/video/" + id + "/";
        episodeDatasend = "";
    }

    return JSON.stringify({
        id: id,
        title: title,
        posterUrl: poster,
        backdropUrl: poster,
        description: d ? decodeHtml(d[1]) : "",
        servers: [{
            name: "PornDos",
            episodes: [{
                id: episodeId,
                name: "Full",
                slug: id || "full",
                datasend: episodeDatasend
            }]
        }],
        quality: "HD",
        status: "Full",
        duration: dur ? dur[1] : "",
        casts: casts.join(", "),
        category: cats.join(", ")
    });
}

/**
 * Parse embed page (HTML ~1KB) để lấy m3u8 thật từ thorcdn.com
 *
 * Embed page chứa:
 *   var player = new Playerjs({id:"kt_player", file:"https://bg-X.thorcdn.com/okhls/ID//master.m3u8", ...});
 */
function parseDetailResponse(html, apiUrl, datasend) {
    html = String(html || "");
    console.log("parseDetailResponse: url=" + apiUrl + " len=" + html.length);
    console.log("parseDetailResponse head=" + html.substring(0, 500));

    var referer = BASE + "/";

    // Trường hợp 1: embed page với Playerjs → lấy file m3u8
    var m3u8Match = html.match(/file:\s*["']([^"']+\.m3u8[^"']*)['"]/i)
        || html.match(/"file"\s*:\s*"([^"]+\.m3u8[^"]*)"/i)
        || html.match(/file\s*=\s*["']([^"']+\.m3u8[^"']*)['"]/i);

    if (m3u8Match) {
        var m3u8Url = m3u8Match[1];
        console.log("parseDetailResponse: found m3u8=" + m3u8Url);
        return JSON.stringify({
            url: m3u8Url,
            isEmbed: false,
            mimeType: "application/x-mpegURL",
            headers: {
                "Referer": "https://www.porndos.com/",
                "Origin": "https://www.porndos.com",
                "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
            },
            subtitles: []
        });
    }

    // Trường hợp 2: trang video gốc (fallback khi không có datasend) → tìm /embed/ID/
    var embedMatch = html.match(/["']((?:https?:\/\/www\.porndos\.com)?\/embed\/(\d+)\/?)["']/i);
    if (embedMatch) {
        var embedUrl = embedMatch[1].indexOf("http") === 0 ? embedMatch[1] : BASE + embedMatch[1];
        console.log("parseDetailResponse: found embed URL=" + embedUrl);
        return JSON.stringify({
            url: embedUrl,
            isEmbed: true,
            headers: {
                "Referer": referer,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            },
            subtitles: []
        });
    }

    // Trường hợp 3: video_id trong flashvars → build embed URL
    var vidIdFallback = html.match(/video_id:\s*'(\d+)'/i);
    if (vidIdFallback) {
        var fallbackEmbed = BASE + "/embed/" + vidIdFallback[1] + "/";
        console.log("parseDetailResponse: fallback embed=" + fallbackEmbed);
        return JSON.stringify({
            url: fallbackEmbed,
            isEmbed: true,
            headers: {
                "Referer": referer,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            },
            subtitles: []
        });
    }

    console.log("parseDetailResponse: không tìm thấy stream nào");
    return JSON.stringify({ url: "", isEmbed: false, headers: { "Referer": referer }, subtitles: [] });
}

/**
 * Bước thứ 2 nếu parseDetailResponse trả isEmbed:true (embed page)
 * Embed page chứa Playerjs với m3u8 từ thorcdn.com
 */
function parseEmbedResponse(html, sourceUrl) {
    html = String(html || "");
    console.log("parseEmbedResponse: url=" + sourceUrl + " len=" + html.length);

    // Lấy m3u8 từ Playerjs
    var m3u8Match = html.match(/file:\s*["']([^"']+\.m3u8[^"']*)['"]/i)
        || html.match(/"file"\s*:\s*"([^"]+\.m3u8[^"]*)"/i);

    if (m3u8Match) {
        var m3u8Url = m3u8Match[1];
        console.log("parseEmbedResponse: m3u8=" + m3u8Url);
        return JSON.stringify({
            url: m3u8Url,
            isEmbed: false,
            mimeType: "application/x-mpegURL",
            headers: {
                "Referer": "https://www.porndos.com/",
                "Origin": "https://www.porndos.com",
                "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
            }
        });
    }

    console.log("parseEmbedResponse: không thấy m3u8");
    return JSON.stringify({ url: "", isEmbed: false });
}

// =============================================================================
// Categories/Countries/Years
// =============================================================================
function parseCategoriesResponse(html, apiUrl) {
    try {
        var res = [];
        var seen = {};
        var re = /<a\s+href="(https?:\/\/www\.porndos\.com\/category\/([^"\/]+)\/?)"\s*>\s*<img[^>]+alt="([^"]+)"/gi;
        var m;
        while ((m = re.exec(html)) !== null) {
            var slug = m[1].replace(BASE, "").replace(/^\/|\/$/g, "");
            var name = decodeHtml(m[3]);
            if (!name || seen[slug]) continue;
            seen[slug] = true;
            res.push({ name: name, slug: slug });
        }
        return JSON.stringify(res);
    } catch (e) { return "[]"; }
}

function parseCountriesResponse(html) { return "[]"; }
function parseYearsResponse(html) { return "[]"; }
