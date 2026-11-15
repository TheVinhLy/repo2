// =============================================================================
// Siêu Tầm Phim (https://www.sieutamphim.art) - Plugin v2.0.0
// Web WordPress: danh sách /tu-khoa/<slug>/, phim /xem-phim/<slug>/,
// tập /xem-phim/<slug>/tap-<số>-<server>-server
// Player: iframe embed.php (base64) -> player-payload (base64 + rot13) -> abyss player
// =============================================================================

var BASE = "https://www.sieutamphim.art";
var UA = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";

function getManifest() {
    return JSON.stringify({
        "id": "sieutamphim",
        "name": "Sưu Tầm Phim",
        "version": "2.0.0",
        "description": "Phim lồng tiếng, thuyết minh, tiếng Việt tại sieutamphim.art",
        "author": "TheVinhLy",
        "baseUrl": "https://www.sieutamphim.art",
        "iconUrl": "https://www.sieutamphim.art/wp-content/themes/sieutamphim/assets/logo.png",
        "referrer": "https://www.sieutamphim.art/",
        "isEnabled": true,
        "isAdult": false,
        "type": "MOVIE",
        "layoutType": "VERTICAL",
        "playerType": "embed",
        "debug": true
    });
}

// =============================================================================
// HOME / CATEGORY / FILTER
// =============================================================================

function getHomeSections() {
    return JSON.stringify([
        { slug: "phim-moi", title: "Phim Mới", type: "Horizontal" },
        { slug: "phim-bo", title: "Phim Bộ", type: "Horizontal" },
        { slug: "phim-le", title: "Phim Lẻ", type: "Horizontal" },
        { slug: "long-tieng", title: "Lồng Tiếng", type: "Horizontal" },
        { slug: "thuyet-minh", title: "Thuyết Minh", type: "Horizontal" },
        { slug: "tieng-viet", title: "Tiếng Việt", type: "Horizontal" },
        { slug: "phu-de", title: "Phụ Đề", type: "Horizontal" }
    ]);
}

function getPrimaryCategories() {
    return JSON.stringify([
        { name: "Phim Mới", slug: "phim-moi" },
        { name: "Phim Bộ", slug: "phim-bo" },
        { name: "Phim Lẻ", slug: "phim-le" },
        { name: "Phim Điện Ảnh", slug: "phim-dien-anh" },
        { name: "Lồng Tiếng", slug: "long-tieng" },
        { name: "Thuyết Minh", slug: "thuyet-minh" },
        { name: "Tiếng Việt", slug: "tieng-viet" },
        { name: "Phụ Đề", slug: "phu-de" },
        { name: "Phim Việt Nam", slug: "phim-viet-nam" },
        { name: "Phim Hàn Quốc", slug: "phim-han-quoc" },
        { name: "Phim Trung Quốc", slug: "phim-trung-quoc" },
        { name: "Phim Nhật Bản", slug: "phim-nhat-ban" },
        { name: "Phim Mỹ", slug: "phim-my" }
    ]);
}

function getFilterConfig() {
    return JSON.stringify({});
}

// =============================================================================
// URL
// =============================================================================

function getUrlList(slug, filtersJson) {
    var filters = {};
    try { filters = JSON.parse(filtersJson || "{}"); } catch (e) {}
    var page = parseInt(filters.page || 1, 10) || 1;
    var tag = filters.category || filters.country || filters.year || slug || "phim-moi";
    var url = BASE + "/tu-khoa/" + tag + "/";
    if (page > 1) url += "page/" + page + "/";
    return url;
}

function getUrlSearch(keyword, filtersJson) {
    var filters = {};
    try { filters = JSON.parse(filtersJson || "{}"); } catch (e) {}
    var page = parseInt(filters.page || 1, 10) || 1;
    var q = encodeURIComponent(keyword || "");
    if (page > 1) return BASE + "/page/" + page + "/?s=" + q;
    return BASE + "/?s=" + q;
}

// slug phim -> trang phim ; link đầy đủ (id tập) -> giữ nguyên
function getUrlDetail(slug, datasend) {
    if (!slug) return BASE;
    if (/^https?:\/\//i.test(slug)) return slug;
    return BASE + "/xem-phim/" + slug + "/";
}

function getUrlCategories() { return BASE + "/"; }
function getUrlCountries() { return BASE + "/"; }
function getUrlYears() { return BASE + "/"; }

// =============================================================================
// HELPERS
// =============================================================================

function decodeEntities(s) {
    return (s || "")
        .replace(/&#8211;/g, "-").replace(/&#8212;/g, "-")
        .replace(/&#8220;/g, '"').replace(/&#8221;/g, '"')
        .replace(/&#8216;/g, "'").replace(/&#8217;/g, "'")
        .replace(/&#038;/g, "&").replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
}

function stripTags(s) {
    return decodeEntities((s || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function slugFromUrl(u) {
    var m = (u || "").match(/\/xem-phim\/([^\/?#"']+)/);
    return m ? m[1] : "";
}

function posterOf(slug) {
    return BASE + "/wp-content/themes/sieutamphim/assets/posters/" + slug + ".webp";
}

function b64decode(str) {
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    str = String(str || "").replace(/-/g, "+").replace(/_/g, "/").replace(/[^A-Za-z0-9+\/]/g, "");
    var out = "", bits = 0, val = 0;
    for (var i = 0; i < str.length; i++) {
        val = (val << 6) | chars.indexOf(str.charAt(i));
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            out += String.fromCharCode((val >> bits) & 255);
        }
    }
    return out;
}

function b64encode(str) {
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    var out = "";
    for (var i = 0; i < str.length; i += 3) {
        var c1 = str.charCodeAt(i);
        var c2 = i + 1 < str.length ? str.charCodeAt(i + 1) : NaN;
        var c3 = i + 2 < str.length ? str.charCodeAt(i + 2) : NaN;
        out += chars.charAt(c1 >> 2) + chars.charAt(((c1 & 3) << 4) | (isNaN(c2) ? 0 : c2 >> 4));
        out += isNaN(c2) ? "=" : chars.charAt(((c2 & 15) << 2) | (isNaN(c3) ? 0 : c3 >> 6));
        out += isNaN(c3) ? "=" : chars.charAt(c3 & 63);
    }
    return out;
}

function rot13(s) {
    return s.replace(/[a-zA-Z]/g, function (c) {
        var b = c <= "Z" ? 65 : 97;
        return String.fromCharCode((c.charCodeAt(0) - b + 13) % 26 + b);
    });
}

// =============================================================================
// PARSE LIST / SEARCH
// =============================================================================

function parseListResponse(html, apiUrl) {
    try {
        html = html || "";
        var start = html.indexOf('class="list-movies"');
        var area = start >= 0 ? html.substring(start) : html;
        var endIdx = area.indexOf('class="pagination"');
        if (endIdx < 0) endIdx = area.indexOf('sidebar-section');
        if (endIdx > 0) area = area.substring(0, endIdx);
        var chunks = area.split(/<div class="item">/);
        var movies = [], seen = {};
        for (var i = 1; i < chunks.length; i++) {
            var c = chunks[i];
            var hm = c.match(/href="([^"]*\/xem-phim\/[^"]+)"/);
            if (!hm) continue;
            var slug = slugFromUrl(hm[1]);
            if (!slug || seen[slug]) continue;
            seen[slug] = true;

            var title = "";
            var t = c.match(/<h2>([\s\S]*?)<\/h2>/);
            if (t) title = stripTags(t[1]);
            if (!title) { t = c.match(/<img[^>]*alt="([^"]*)"/); if (t) title = decodeEntities(t[1]); }
            if (!title) title = slug;

            var q = "";
            t = c.match(/class="tag-content"[^>]*>([\s\S]*?)<\/div>/);
            if (t) q = stripTags(t[1]);

            movies.push({ id: slug, title: title, posterUrl: posterOf(slug), quality: q, slug: slug });
        }

        var cur = 1;
        var cm = html.match(/class="page-numbers current">(\d+)</);
        if (cm) cur = parseInt(cm[1], 10);
        var max = cur;
        var m;
        var re2 = /<a[^>]*class="page-numbers"[^>]*>(\d+)<\/a>/g;
        while ((m = re2.exec(html)) !== null) { var n = parseInt(m[1], 10); if (n > max) max = n; }
        var hasNext = /class="next page-numbers"/.test(html);
        var total = hasNext ? Math.max(max, cur + 1) : max;

        return JSON.stringify({
            items: movies,
            pagination: { currentPage: cur, totalPages: total, totalItems: movies.length, itemsPerPage: movies.length || 24 }
        });
    } catch (e) {
        console.log("parseListResponse error: " + e);
        return JSON.stringify({ items: [], pagination: { currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: 0 } });
    }
}

function parseSearchResponse(html, apiUrl) {
    return parseListResponse(html, apiUrl);
}

// =============================================================================
// PARSE DETAIL
// =============================================================================

// Từ trang xem phim: danh sách server + danh sách tập của server đang xem
function parseWatchPage(html) {
    var servers = [], eps = [], m;
    var re = /<a[^>]*href="([^"]*\/tap-[^"]*-server\/?)"[^>]*class="server-dropdown-item[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
    while ((m = re.exec(html)) !== null) {
        var nm = m[2].match(/class="server-item-name"[^>]*>([^<]+)</);
        servers.push({ name: nm ? stripTags(nm[1]) : "Server", href: m[1], active: /is-active/.test(m[0]) });
    }
    var re2 = /<a[^>]*href="([^"]*\/tap-[^"]*-server\/?)"[^>]*class="ep-card-item[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
    while ((m = re2.exec(html)) !== null) {
        var en = m[2].match(/class="ep-name"[^>]*>([^<]+)</);
        eps.push({ name: en ? stripTags(en[1]) : "Tập", href: m[1] });
    }
    return { servers: servers, episodes: eps };
}

function fetchPage(url) {
    try {
        var r = httpRequest(url, { method: "GET", headers: { "User-Agent": UA, "Referer": BASE + "/" } });
        return (r && r.body) ? r.body : "";
    } catch (e) {
        console.log("fetchPage error: " + e);
        return "";
    }
}

function absUrl(u) {
    if (!u) return "";
    if (u.indexOf("//") === 0) return "https:" + u;
    if (u.charAt(0) === "/") return BASE + u;
    return u;
}

function buildEpisodes(list, serverName) {
    var out = [];
    for (var i = 0; i < list.length; i++) {
        var h = list[i].href;
        var sm = h.match(/\/tap-(.*?)-([a-z0-9]+)-server/i);
        var key = sm ? (sm[2] + "-" + sm[1]) : ("ep" + i);
        out.push({ name: list[i].name, slug: key, id: h });
    }
    return out;
}

function parseMovieDetail(html, apiUrl, datasend) {
    try {
        html = html || "";
        var slug = slugFromUrl(apiUrl);
        if (!slug) { var cm = html.match(/rel="canonical" href="([^"]+)"/); if (cm) slug = slugFromUrl(cm[1]); }

        var title = "";
        var t = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
        if (t) title = stripTags(t[1]);
        if (!title) { t = html.match(/<meta property="og:title" content="([^"]+)"/); if (t) title = decodeEntities(t[1]); }

        var poster = "";
        t = html.match(/<meta property="og:image" content="([^"]+)"/);
        if (t) poster = decodeEntities(t[1]).replace(/\?v=\d+$/, "");
        if (!poster && slug) poster = posterOf(slug);

        var desc = "";
        t = html.match(/class="description-movie"[^>]*>([\s\S]*?)<\/div>/);
        if (t) desc = t[1].replace(/<\/p>/g, "\n").replace(/<[^>]+>/g, " ");
        desc = decodeEntities(desc).replace(/[ \t]+/g, " ").replace(/\n\s*/g, "\n").trim();

        var status = "";
        t = html.match(/class="badge-status-h1"[^>]*>([^<]+)</);
        if (t) status = stripTags(t[1]);

        var director = "", casts = "", year = "";
        t = desc.match(/Đạo Diễn\s*:\s*([^\n]+)/i); if (t) director = t[1].trim();
        t = desc.match(/Diễn Viên\s*:\s*([^\n]+)/i); if (t) casts = t[1].trim();
        t = desc.match(/Năm Phát Hành\s*:\s*\(?(\d{4})/i); if (t) year = t[1];

        var cats = [], country = "";
        var tre = /<a[^>]*href="[^"]*\/tu-khoa\/([^\/"]+)\/"[^>]*class="tag-name"[^>]*>([^<]*)</g, m;
        while ((m = tre.exec(html)) !== null) {
            var tn = stripTags(m[2]);
            if (/^\d{4}$/.test(tn)) { if (!year) year = tn; continue; }
            if (/^phim-(my|uc|anh|nga|phap|an-do|singapore|thai-lan|viet-nam|dai-loan|han-quoc|nhat-ban|philippines|hong-kong|trung-quoc|tay-ban-nha|khac)$/.test(m[1])) {
                if (!country) country = tn.replace(/^Phim\s+/i, "");
                continue;
            }
            if (cats.length < 8) cats.push(tn);
        }

        // Link xem phim đầu tiên
        var watch = "";
        t = html.match(/class="watch-movie"[^>]*>\s*<a[^>]*href="([^"]+)"/);
        if (t) watch = decodeEntities(t[1]);
        if (!watch) { t = html.match(/href="([^"]*\/xem-phim\/[^"\/]+\/tap-[^"]*-server\/?)"/); if (t) watch = t[1]; }

        var servers = [];
        if (watch) {
            var wHtml = fetchPage(watch);
            var info = parseWatchPage(wHtml);
            console.log("watch servers=" + info.servers.length + " eps=" + info.episodes.length);
            if (info.servers.length === 0 && info.episodes.length > 0) {
                servers.push({ name: "Server", episodes: buildEpisodes(info.episodes) });
            }
            for (var si = 0; si < info.servers.length && si < 5; si++) {
                var sv = info.servers[si];
                var list = info.episodes;
                if (!sv.active) {
                    var h2 = fetchPage(sv.href);
                    list = parseWatchPage(h2).episodes;
                }
                if (list.length === 0) list = [{ name: "Xem phim", href: sv.href }];
                servers.push({ name: sv.name, episodes: buildEpisodes(list) });
            }
            if (servers.length === 0) {
                servers.push({ name: "Server", episodes: [{ name: "Xem phim", slug: "full", id: watch }] });
            }
        }

        return JSON.stringify({
            id: slug,
            title: title,
            posterUrl: poster,
            backdropUrl: poster,
            description: desc,
            year: year,
            quality: status,
            status: status,
            category: cats.join(", "),
            country: country,
            casts: casts,
            director: director,
            servers: servers
        });
    } catch (e) {
        console.log("parseMovieDetail error: " + e);
        return "{}";
    }
}

// =============================================================================
// STREAM
// =============================================================================

// Bước 1: trang xem tập -> lấy link embed.php (đã mã hóa base64 trong script)
function parseDetailResponse(html, apiUrl, datasend) {
    try {
        html = html || "";
        var page = (apiUrl || "").split("|")[0];
        var headers = { "User-Agent": UA, "Referer": page || (BASE + "/") };

        if (page.indexOf("embed.php") >= 0 || /name="player-payload"/.test(html)) {
            return parseEmbedResponse(html, apiUrl);
        }

        var m = html.match(/encodedUrl\s*=\s*"([A-Za-z0-9+\/=_-]+)"/);
        if (m) {
            var path = b64decode(m[1]);
            console.log("embed path=" + path);
            if (path) {
                var u = absUrl(path);
                return JSON.stringify({ url: u, isEmbed: true, headers: headers, subtitles: [] });
            }
        }

        // Dự phòng: iframe có src thật / m3u8 trong trang
        m = html.match(/<iframe[^>]*id="player-iframe"[^>]*\ssrc="(https?:[^"]+)"/);
        if (m) return JSON.stringify({ url: decodeEntities(m[1]), isEmbed: true, headers: headers, subtitles: [] });
        m = html.match(/(https?:\/\/[^"'\\\s<>]+\.m3u8[^"'\\\s<>]*)/);
        if (m) return JSON.stringify({ url: m[1], isEmbed: false, headers: headers, subtitles: [] });

        console.log("Không tìm thấy player trong trang");
        return "{}";
    } catch (e) {
        console.log("parseDetailResponse error: " + e);
        return "{}";
    }
}

// Bước 2: embed.php -> player-payload (base64 -> rot13 -> link player thật)
function parseEmbedResponse(html, sourceUrl) {
    try {
        html = html || "";
        var m = html.match(/name="player-payload"\s+content="([^"]+)"/) || html.match(/data-payload="([^"]+)"/);
        var real = "";
        if (m) real = rot13(b64decode(m[1]));
        console.log("player payload -> " + real);

        if (!real) {
            var ifm = html.match(/<iframe[^>]*\ssrc="(https?:[^"]+)"/);
            if (ifm) real = decodeEntities(ifm[1]);
        }
        if (!real) {
            var m3 = html.match(/(https?:\/\/[^"'\\\s<>]+\.m3u8[^"'\\\s<>]*)/);
            if (m3) real = m3[1];
        }
        if (!real) return "{}";

        var headers = { "User-Agent": UA, "Referer": BASE + "/" };
        if (/\.m3u8|\.mp4/i.test(real)) {
            return JSON.stringify({ url: real, isEmbed: false, headers: headers, subtitles: [] });
        }

        // short.ink / short.icu -> abyssplayer; bọc trong iframe để tránh bị chuyển hướng
        real = real.replace(/https?:\/\/(short\.ink|short\.icu)\//, "https://abyssplayer.com/");
        if (/abyss/i.test(real)) {
            var wrap = '<html><body style="margin:0;padding:0;background:#000;"><iframe src="' + real +
                '" style="width:100%;height:100%;border:none;" allowfullscreen></iframe></body></html>';
            return JSON.stringify({
                url: "data:text/html;base64," + b64encode(wrap),
                isEmbed: true,
                headers: headers,
                subtitles: []
            });
        }
        return JSON.stringify({ url: real, isEmbed: true, headers: headers, subtitles: [] });
    } catch (e) {
        console.log("parseEmbedResponse error: " + e);
        return "{}";
    }
}

// =============================================================================
// THỂ LOẠI / QUỐC GIA / NĂM (theo menu trên web)
// =============================================================================

function parseCategoriesResponse(html) {
    return JSON.stringify([
        { name: "Phim Bộ", slug: "phim-bo" },
        { name: "Phim Lẻ", slug: "phim-le" },
        { name: "Phim Mới", slug: "phim-moi" },
        { name: "Phim Điện Ảnh", slug: "phim-dien-anh" },
        { name: "Lồng Tiếng", slug: "long-tieng" },
        { name: "Thuyết Minh", slug: "thuyet-minh" },
        { name: "Tiếng Việt", slug: "tieng-viet" },
        { name: "Phụ Đề", slug: "phu-de" },
        { name: "Series", slug: "series" },
        { name: "Movie", slug: "movie" },
        { name: "Bản Quyền", slug: "ban-quyen" },
        { name: "VietSub", slug: "vietsub" },
        { name: "VietDub", slug: "vietdub" },
        { name: "Voice-Over", slug: "voice-over" }
    ]);
}

function parseCountriesResponse(html) {
    return JSON.stringify([
        { name: "Phim Mỹ", slug: "phim-my" },
        { name: "Phim Úc", slug: "phim-uc" },
        { name: "Phim Anh", slug: "phim-anh" },
        { name: "Phim Nga", slug: "phim-nga" },
        { name: "Phim Pháp", slug: "phim-phap" },
        { name: "Phim Ấn Độ", slug: "phim-an-do" },
        { name: "Phim Singapore", slug: "phim-singapore" },
        { name: "Phim Thái Lan", slug: "phim-thai-lan" },
        { name: "Phim Việt Nam", slug: "phim-viet-nam" },
        { name: "Phim Đài Loan", slug: "phim-dai-loan" },
        { name: "Phim Hàn Quốc", slug: "phim-han-quoc" },
        { name: "Phim Nhật Bản", slug: "phim-nhat-ban" },
        { name: "Phim Philippines", slug: "phim-philippines" },
        { name: "Phim Hồng Kông", slug: "phim-hong-kong" },
        { name: "Phim Trung Quốc", slug: "phim-trung-quoc" },
        { name: "Phim Tây Ban Nha", slug: "phim-tay-ban-nha" },
        { name: "Phim Khác", slug: "phim-khac" }
    ]);
}

function parseYearsResponse(html) {
    var out = [];
    for (var y = 2026; y >= 2011; y--) out.push({ name: String(y), slug: String(y) });
    return JSON.stringify(out);
}
