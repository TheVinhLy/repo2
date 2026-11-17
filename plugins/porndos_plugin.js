// =============================================================================
// VAAPP Plugin: PornDos  (https://www.porndos.com)
// Author: TheVinhLy
// Version: 1.0.0
// Dựa trên HUONG_DAN.md + plugin_template.js + hqporner_plugin.js
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

// "/video/slug-name_v123/" -> "slug-name_v123"
function pathToSlug(href) {
    var m = String(href).match(/\/video\/([^"'?#|\s\/]+)/i);
    return m ? m[1] : "";
}

// lấy số trang hiện tại từ URL
function pageFromUrl(url) {
    url = String(url || "").split("|")[0];
    // /videos_70/3/ hoặc /category/xxx_cXX/3/ hoặc /search/kw/3/
    var m = url.match(/\/(\d+)\/?$/);
    return m ? parseInt(m[1], 10) : 1;
}

// Ghép URL phân trang: thêm /PAGE/ vào cuối base path
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
        "version": "1.0.0",
        "description": "Free HD Porn Videos từ porndos.com",
        "author": "TheVinhLy",
        "baseUrl": "https://www.porndos.com",
        "iconUrl": "https://www.porndos.com/favicon.ico",
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
        { slug: "home",           title: "Mới Nhất",    type: "Horizontal", path: "" },
        { slug: "videos_70",      title: "Tất Cả Video", type: "Horizontal", path: "" },
        { slug: "most-viewed_83", title: "Xem Nhiều",   type: "Horizontal", path: "" },
        { slug: "top-rated_52",   title: "Đánh Giá Cao", type: "Horizontal", path: "" }
    ]);
}

function getPrimaryCategories() {
    return JSON.stringify([
        { name: "Mới Nhất",        slug: "home" },
        { name: "Tất Cả Video",    slug: "videos_70" },
        { name: "Xem Nhiều",       slug: "most-viewed_83" },
        { name: "Đánh Giá Cao",    slug: "top-rated_52" },
        { name: "Thể Loại",        slug: "categories_84" },
        { name: "Diễn Viên",       slug: "pornstars_42" },
        { name: "Studios",         slug: "studios_91" }
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

    // Trang chủ
    if (slug === "home" || slug === "") {
        return page > 1 ? BASE + "/" + page + "/" : BASE + "/";
    }

    // Các slug cố định có số ID nhúng: videos_70, most-viewed_83, top-rated_52,
    // categories_84, pornstars_42, studios_91
    // => giữ nguyên slug, thêm /page/
    return buildPagedUrl(BASE + "/" + slug, page);
}

function getUrlSearch(keyword, filtersJson) {
    var page = JSON.parse(filtersJson || "{}").page || 1;
    var kw = encodeURIComponent(String(keyword || "").trim()).replace(/%20/g, "+");
    return buildPagedUrl(BASE + "/search/" + kw, page);
}

// slug = "slug-name_v123"
function getUrlDetail(slug, datasend) {
    if (!slug) return "";
    slug = String(slug).split("|")[0];
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

/**
 * Parse danh sách video, thể loại, diễn viên, studios
 */
function parseListResponse(html, apiUrl) {
    var empty = JSON.stringify({ items: [], pagination: { currentPage: 1, totalPages: 1 } });
    try {
        html = String(html || "");
        var url = String(apiUrl || "");
        var items = [];
        var seen = {};
        var m;

        // ---- Trang Categories: /categories_84/ ----
        if (/\/categories_?/i.test(url) && !/\/category\//i.test(url)) {
            var catRe = /<a\s+href="(https?:\/\/www\.porndos\.com\/category\/[^"]+)"[^>]*>[\s\S]*?<img[^>]+(?:data-src|src)="([^"]+)"[^>]+alt="([^"]+)"/gi;
            while ((m = catRe.exec(html)) !== null) {
                var cUrl = m[1];
                var cSlug = cUrl.replace(BASE, "").replace(/^\/|\/$/g, "");
                if (!cSlug || seen[cSlug]) continue;
                seen[cSlug] = true;
                items.push({
                    id: cSlug,
                    title: decodeHtml(m[3]),
                    posterUrl: absUrl(m[2]),
                    quality: "CAT"
                });
            }
            return JSON.stringify({ items: items, pagination: { currentPage: 1, totalPages: 1 } });
        }

        // ---- Trang Pornstars: /pornstars_42/ ----
        if (/\/pornstars/i.test(url)) {
            var psRe = /<a\s+href="(https?:\/\/www\.porndos\.com\/pornstar\/[^"]+)"[^>]*>[\s\S]*?<img[^>]+(?:data-src|src)="([^"]+)"[^>]+alt="([^"]+)"/gi;
            while ((m = psRe.exec(html)) !== null) {
                var psUrl = m[1];
                var psSlug = psUrl.replace(BASE, "").replace(/^\/|\/$/g, "");
                if (!psSlug || seen[psSlug]) continue;
                seen[psSlug] = true;
                items.push({
                    id: psSlug,
                    title: decodeHtml(m[3]),
                    posterUrl: absUrl(m[2]),
                    quality: "ACTRESS"
                });
            }
            var curPage = pageFromUrl(url);
            return JSON.stringify({ items: items, pagination: { currentPage: curPage, totalPages: 999 } });
        }

        // ---- Trang Studios: /studios_91/ ----
        if (/\/studios/i.test(url)) {
            var stRe = /<a\s+href="(https?:\/\/www\.porndos\.com\/studio\/[^"]+)"[^>]*>[\s\S]*?<img[^>]+(?:data-src|src)="([^"]+)"[^>]+alt="([^"]+)"/gi;
            while ((m = stRe.exec(html)) !== null) {
                var stUrl = m[1];
                var stSlug = stUrl.replace(BASE, "").replace(/^\/|\/$/g, "");
                if (!stSlug || seen[stSlug]) continue;
                seen[stSlug] = true;
                items.push({
                    id: stSlug,
                    title: decodeHtml(m[3]),
                    posterUrl: absUrl(m[2]),
                    quality: "CAT"
                });
            }
            return JSON.stringify({ items: items, pagination: { currentPage: 1, totalPages: 1 } });
        }

        // ---- Danh sách video thông thường ----
        // Cấu trúc: <div class="item" ...> <a href="/video/SLUG/"> <img data-src="..." alt="TITLE">
        // Tách block theo thẻ <div class="item"
        var blocks = html.split(/<div\s+class="item"/i);
        blocks.shift(); // bỏ phần trước item đầu tiên

        for (var i = 0; i < blocks.length; i++) {
            var b = blocks[i];

            // Link video
            var hm = b.match(/href="(https?:\/\/www\.porndos\.com\/video\/[^"]+)"/i);
            if (!hm) continue;
            var slug = pathToSlug(hm[1]);
            if (!slug || seen[slug]) continue;

            // Poster (data-src ưu tiên hơn src)
            var im = b.match(/(?:data-src|src)="(\/images\/thumb\/[^"]+)"/i);

            // Title từ alt của img
            var tm = b.match(/alt="([^"]+)"/i);

            // Thời lượng
            var dm = b.match(/<span[^>]*class="right"[^>]*>[\s\S]*?<\/span>/i);
            var dur = "";
            if (dm) {
                var durMatch = dm[0].match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
                if (durMatch) dur = durMatch[1];
            }

            seen[slug] = true;
            items.push({
                id: slug,
                title: tm ? decodeHtml(tm[1]) : slug.replace(/_v\d+$/, "").replace(/-/g, " "),
                posterUrl: im ? absUrl(im[1]) : "",
                description: dur,
                quality: "HD"
            });
        }

        // Phân trang: tìm số trang lớn nhất trong .pages
        var current = pageFromUrl(url);
        var total = current;
        var pageRe = /href="[^"]*\/(\d+)\/"[^>]*title="Page \d+"/gi;
        var pm;
        while ((pm = pageRe.exec(html)) !== null) {
            var n = parseInt(pm[1], 10);
            if (n < 10000 && n > total) total = n;
        }

        return JSON.stringify({
            items: items,
            pagination: { currentPage: current, totalPages: total }
        });
    } catch (e) {
        console.log("parseListResponse lỗi: " + e);
        return empty;
    }
}

function parseSearchResponse(html, apiUrl) {
    return parseListResponse(html, apiUrl);
}

/**
 * Parse chi tiết video: title, poster, cast, categories, description, servers
 * Trang có nhiều chất lượng: 360p, 480p, 720p, 1080p
 */
function parseMovieDetail(html, apiUrl, datasend) {
    html = String(html || "");

    // ID từ URL hoặc canonical
    var id = pathToSlug(apiUrl || "");
    if (!id) {
        var c = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i);
        if (c) id = pathToSlug(c[1]);
    }

    // Title
    var t = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
        || html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
    var title = t ? decodeHtml(t[1]) : "Video";

    // Poster
    var p = html.match(/<link[^>]+fetchpriority="high"[^>]+href="([^"]+\.webp)"/i)
        || html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)
        || html.match(/preview_url:\s*'([^']+)'/i);
    var poster = p ? absUrl(p[1]) : "";

    // Description (meta)
    var d = html.match(/<meta[^>]+itemprop="description"[^>]+content="([^"]*)"/i)
        || html.match(/<meta[^>]+(?:name="description"|property="og:description")[^>]+content="([^"]*)"/i);

    // Duration
    var dur = html.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);

    // Categories từ links .links a
    var cats = [];
    var seenC = {};
    var catRe = /href="(https?:\/\/www\.porndos\.com\/category\/([^"\/]+)\/?)">[\s\S]*?<\/a>/gi;
    var cm;
    while ((cm = catRe.exec(html)) !== null) {
        var catSlug = cm[1].replace(BASE, "").replace(/^\/|\/$/g, "");
        // Lấy tên từ alt hoặc text
        var catName = cm[0].match(/<i[^>]*>[\s\S]*?<\/i>([\s\S]*?)<\/a>/i);
        var nameStr = catName ? decodeHtml(catName[1]) : catSlug;
        if (nameStr && !seenC[catSlug]) {
            seenC[catSlug] = true;
            cats.push("[" + nameStr + "](" + catSlug + ")");
        }
    }
    // Từ flashvars video_categories nếu có
    var vcMatch = html.match(/video_categories:\s*'([^']+)'/i);
    if (vcMatch && cats.length === 0) {
        vcMatch[1].split(",").forEach(function(c) {
            c = c.trim();
            if (c) cats.push(c);
        });
    }

    // Pornstars/Casts
    var casts = [];
    var seenA = {};
    var castRe = /href="(https?:\/\/www\.porndos\.com\/pornstar\/([^"\/]+)\/?)">[\s\S]*?<\/a>/gi;
    var am;
    while ((am = castRe.exec(html)) !== null) {
        var psSlug = am[1].replace(BASE, "").replace(/^\/|\/$/g, "");
        var psName = am[0].match(/<i[^>]*>[\s\S]*?<\/i>([\s\S]*?)<\/a>/i);
        var pName = psName ? decodeHtml(psName[1]) : psSlug;
        if (pName && !seenA[psSlug]) {
            seenA[psSlug] = true;
            casts.push("[" + pName + "](" + psSlug + ")");
        }
    }

    // Lấy video ID số từ flashvars để build URLs
    var vidIdMatch = html.match(/video_id:\s*'(\d+)'/i);
    var vidId = vidIdMatch ? vidIdMatch[1] : "";

    // Xây dựng danh sách chất lượng từ flashvars
    // video_url (360p), video_alt_url (480p), video_alt_url2 (720p), video_alt_url3 (1080p)
    var episodes = [];

    // Dùng regex lấy trực tiếp từ flashvars
    var urlMatches = [
        { key: "video_url",       textKey: "video_url_text"       },
        { key: "video_alt_url",   textKey: "video_alt_url_text"   },
        { key: "video_alt_url2",  textKey: "video_alt_url2_text"  },
        { key: "video_alt_url3",  textKey: "video_alt_url3_text"  }
    ];

    var seenUrl = {};
    for (var qi = 0; qi < urlMatches.length; qi++) {
        var uk = urlMatches[qi];
        // Khớp: video_url: 'https://...'
        var urlRe = new RegExp(uk.key + ":\\s*'(https?://[^']+)'", "i");
        var textRe = new RegExp(uk.textKey + ":\\s*'([^']+)'", "i");
        var uMatch = html.match(urlRe);
        var tMatch = html.match(textRe);
        if (!uMatch) continue;
        var epUrl = uMatch[1];
        var epLabel = tMatch ? tMatch[1] : (qi === 0 ? "360p" : qi === 1 ? "480p" : qi === 2 ? "720p" : "1080p");
        if (seenUrl[epUrl]) continue;
        seenUrl[epUrl] = true;
        // Slug duy nhất theo quality label
        var epSlug = epLabel.replace(/[^a-z0-9]/gi, "").toLowerCase();
        episodes.push({
            id: epUrl,
            name: epLabel,
            slug: epSlug || ("q" + qi)
        });
    }

    // Nếu không tìm được episodes từ flashvars, dùng get_stream pattern
    if (episodes.length === 0 && vidId) {
        var qualities = ["360", "480", "720", "1080"];
        for (var qi2 = 0; qi2 < qualities.length; qi2++) {
            var q = qualities[qi2];
            episodes.push({
                id: BASE + "/get_stream/" + vidId + "-" + q + ".mp4",
                name: q + "p",
                slug: q + "p"
            });
        }
    }

    return JSON.stringify({
        id: id,
        title: title,
        posterUrl: poster,
        backdropUrl: poster,
        description: d ? decodeHtml(d[1]) : "",
        servers: [
            {
                name: "PornDos",
                episodes: episodes.length > 0 ? episodes : [
                    { id: id, name: "Full", slug: id || "full" }
                ]
            }
        ],
        quality: "HD",
        status: "Full",
        duration: dur ? dur[1] : "",
        casts: casts.join(", "),
        category: cats.join(", ")
    });
}

/**
 * Parse link video.
 * episode.id đã là URL .mp4 trực tiếp (https://www.porndos.com/get_stream/XXXX-720.mp4)
 * => App sẽ phát thẳng mà không cần gọi hàm này.
 * Nhưng vẫn implement để xử lý fallback hoặc nếu App gọi.
 */
function parseDetailResponse(html, apiUrl, datasend) {
    html = String(html || "");
    var referer = BASE + "/";

    // Thử trích stream trực tiếp từ flashvars
    var streams = extractStreams(html);
    if (streams.length > 0) {
        var best = streams[0];
        return JSON.stringify({
            url: best.url,
            isEmbed: false,
            mimeType: "video/mp4",
            headers: {
                "Referer": referer,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            },
            subtitles: []
        });
    }

    // Nếu apiUrl là link .mp4 trực tiếp
    var cleanUrl = String(apiUrl || "").split("|")[0];
    if (cleanUrl.match(/\.mp4(\?.*)?$/i)) {
        return JSON.stringify({
            url: cleanUrl,
            isEmbed: false,
            mimeType: "video/mp4",
            headers: { "Referer": referer },
            subtitles: []
        });
    }

    console.log("parseDetailResponse: không tìm thấy stream, url=" + apiUrl);
    return JSON.stringify({ url: "", isEmbed: false, headers: { "Referer": referer }, subtitles: [] });
}

function parseEmbedResponse(html, sourceUrl) {
    html = String(html || "");
    var streams = extractStreams(html);
    if (streams.length > 0) {
        var best = streams[0];
        return JSON.stringify({
            url: best.url,
            isEmbed: false,
            mimeType: "video/mp4",
            headers: { "Referer": BASE + "/" }
        });
    }
    return JSON.stringify({ url: "", isEmbed: false });
}

// Lấy tất cả URL mp4/m3u8, sắp xếp chất lượng cao → thấp
function extractStreams(html) {
    var out = [];
    var seen = {};

    function push(u, label) {
        u = absUrl(u);
        if (!u || seen[u]) return;
        // Chỉ nhận URL từ porndos.com/get_stream hoặc cdn
        if (u.indexOf("get_stream") === -1 && !u.match(/\.mp4|\.m3u8/i)) return;
        seen[u] = true;
        // Chất lượng lấy từ filename: /9456-1080.mp4
        var qm = u.match(/[_-](\d{3,4})\.(?:mp4|m3u8)/i)
            || String(label || "").match(/^(\d{3,4})p?$/);
        out.push({ url: u, q: qm ? parseInt(qm[1], 10) : 0 });
    }

    // Từ flashvars video_url, video_alt_url, ...
    var fvRe = /video(?:_alt)?_url\d*:\s*'(https?:\/\/[^']+\.mp4[^']*)'/gi;
    var m;
    while ((m = fvRe.exec(html)) !== null) push(m[1], m[1]);

    // Từ <source src="...">
    var srcRe = /<source[^>]+src=['"]([^'"]+)['"]/gi;
    while ((m = srcRe.exec(html)) !== null) push(m[1], m[1]);

    // Fallback: bắt mọi URL get_stream
    var gsRe = /(https?:\/\/[^"'\s<>]+\/get_stream\/[^"'\s<>]+\.mp4(?:\?[^"'\s<>]*)?)/gi;
    while ((m = gsRe.exec(html)) !== null) push(m[1], m[1]);

    out.sort(function(a, b) { return b.q - a.q; });
    return out;
}

// =============================================================================
// Categories/Countries/Years
// =============================================================================
function parseCategoriesResponse(html, apiUrl) {
    try {
        var res = [];
        var seen = {};
        var re = /<a\s+href="(https?:\/\/www\.porndos\.com\/category\/([^"\/]+)\/?)"\s*>[\s\S]*?<img[^>]+alt="([^"]+)"/gi;
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
