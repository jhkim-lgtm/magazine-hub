const state = {
  rowCount: 3,
  results: [],
  generatedAt: null,
  currentJob: null,
  health: null,
  activeTab: "audit",
  discovery: {
    loaded: false,
    loading: false,
    items: [],
    stats: {},
    meta: {},
    category: "all",
    featuredOnly: false,
    type: "all",
    market: "all",
    search: "",
    sort: "featured_desc",
    view: "grid",
    visibleCount: 24,
  },
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const PUBLIC_BACKEND_FALLBACK = "https://promotions-intellectual-tour-composer.trycloudflare.com";
let API_BASE = window.location.hostname === "jhkim-lgtm.github.io" ? PUBLIC_BACKEND_FALLBACK : "";
const apiUrl = (path) => `${API_BASE}${path}`;

function validPublicApiBase(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && (
      url.hostname.endsWith(".trycloudflare.com") ||
      url.hostname.endsWith(".ts.net")
    ) ? url.origin : "";
  } catch {
    return "";
  }
}

async function resolvePublicApiBase() {
  if (window.location.hostname !== "jhkim-lgtm.github.io") return;
  const stamp = Date.now();
  const registries = [
    `https://raw.githubusercontent.com/jhkim-lgtm/magazine-hub/main/backend.json?t=${stamp}`,
    `backend.json?t=${stamp}`,
  ];
  for (const registry of registries) {
    try {
      const response = await fetch(registry, { cache: "no-store" });
      if (!response.ok) continue;
      const payload = await response.json();
      const resolved = validPublicApiBase(payload.api_base);
      if (resolved) {
        API_BASE = resolved;
        return;
      }
    } catch {
      // Keep the last known public tunnel while the registry is refreshing.
    }
  }
}

const els = {
  form: $("#auditForm"),
  inputs: $("#accountInputs"),
  add: $("#addAccountButton"),
  sample: $("#sampleButton"),
  count: $("#queueCount"),
  analyze: $("#analyzeButton"),
  scanMode: $("#scanMode"),
  scanEstimate: $("#scanEstimate"),
  forceRefresh: $("#forceRefresh"),
  connectionPill: $("#connectionPill"),
  connectionText: $("#connectionText"),
  resultsSection: $("#results"),
  comparison: $("#comparisonTable"),
  resultStack: $("#resultStack"),
  reportMeta: $("#reportMeta"),
  loader: $("#loadingOverlay"),
  loaderTitle: $("#loadingTitle"),
  loaderDetail: $("#loadingDetail"),
  progressBar: $("#progressBar"),
  hideLoader: $("#hideLoaderButton"),
  toast: $("#toast"),
  auditView: $("#auditView"),
  discoveryView: $("#discoveryView"),
  appTabs: $$('[data-app-tab]'),
  discoveryTabCount: $("#discoveryTabCount"),
  discoveryStats: $("#discoveryStats"),
  discoveryMeta: $("#discoveryMeta"),
  discoverySearch: $("#discoverySearch"),
  discoveryCategoryFilters: $("#discoveryCategoryFilters"),
  discoveryType: $("#discoveryType"),
  discoveryMarket: $("#discoveryMarket"),
  discoverySort: $("#discoverySort"),
  discoveryGrid: $("#discoveryGrid"),
  discoveryResultCount: $("#discoveryResultCount"),
  discoveryLoadMore: $("#discoveryLoadMore"),
  refreshDiscovery: $("#refreshDiscoveryButton"),
  discoveryViewButtons: $$('[data-discovery-view]'),
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatNumber(value) {
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 }).format(Number(value || 0));
}

function formatCompact(value) {
  const number = Number(value || 0);
  if (number >= 100000000) return `${(number / 100000000).toFixed(number >= 1000000000 ? 0 : 1)}억`;
  if (number >= 10000) return `${(number / 10000).toFixed(number >= 100000 ? 1 : 2).replace(/\.0+$/, "")}만`;
  if (number >= 1000) return `${(number / 1000).toFixed(1).replace(/\.0$/, "")}천`;
  return formatNumber(number);
}

function formatMoney(value) {
  const amount = Number(value || 0);
  const absolute = Math.abs(amount);
  const sign = amount < 0 ? "−" : "";
  if (absolute >= 100000000) return `${sign}${(absolute / 100000000).toFixed(1).replace(/\.0$/, "")}억원`;
  if (absolute >= 10000) return `${sign}${Math.round(absolute / 10000).toLocaleString("ko-KR")}만원`;
  return `${sign}${Math.round(absolute).toLocaleString("ko-KR")}원`;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove("show"), 2800);
}

function captureRows() {
  return $$(".account-bundle", els.inputs).map((bundle) => {
    const company = {};
    $$('[data-company-field]', bundle).forEach((field) => {
      company[field.dataset.companyField] = field.type === "checkbox" ? field.checked : field.value;
    });
    return {
      account: $('[data-field="account"]', bundle)?.value || "",
      company,
    };
  });
}

function selected(value, expected) {
  return String(value || "") === expected ? " selected" : "";
}

function renderInputRows(values = null) {
  const captured = values || captureRows();
  const currentRows = captured.map((row) => typeof row === "string" ? { account: row, company: {} } : row);
  els.inputs.innerHTML = Array.from({ length: state.rowCount }, (_, index) => `
    <div class="account-bundle" data-index="${index}">
      <label class="account-row">
        <span class="row-number">${String(index + 1).padStart(2, "0")}</span>
        <input type="text" inputmode="url" autocomplete="off" spellcheck="false"
          data-field="account" aria-label="인스타그램 계정 ${index + 1}"
          placeholder="https://instagram.com/account"
          value="${escapeHtml(currentRows[index]?.account || "")}">
        <button type="button" class="remove-row" aria-label="계정 행 삭제" data-index="${index}">×</button>
      </label>
      <details class="company-input"${Object.values(currentRows[index]?.company || {}).some((value) => value && value !== "auto") ? " open" : ""}>
        <summary><span>＋ 법인·브랜드 가치 반영</span><small>선택 입력 · 아이즈매거진은 공개 재무 자동 연결</small></summary>
        <div class="company-fields">
          <label class="field-wide"><span>거래 범위</span><select data-company-field="scope">
            <option value="auto"${selected(currentRows[index]?.company?.scope, "auto")}>자동 비교</option>
            <option value="account_only"${selected(currentRows[index]?.company?.scope, "account_only")}>Instagram 계정만</option>
            <option value="brand_assets"${selected(currentRows[index]?.company?.scope, "brand_assets")}>브랜드·영업자산</option>
            <option value="company_equity"${selected(currentRows[index]?.company?.scope, "company_equity")}>운영회사 지분</option>
          </select></label>
          <label><span>법인명</span><input data-company-field="company_name" autocomplete="organization" placeholder="주식회사 ○○" value="${escapeHtml(currentRows[index]?.company?.company_name || "")}"></label>
          <label><span>기준연도</span><input data-company-field="fiscal_year" inputmode="numeric" placeholder="2025" value="${escapeHtml(currentRows[index]?.company?.fiscal_year || "")}"></label>
          <label><span>매출 · 억원</span><input data-company-field="revenue_eok" inputmode="decimal" placeholder="예: 113.2" value="${escapeHtml(currentRows[index]?.company?.revenue_eok || "")}"></label>
          <label><span>영업이익 · 억원</span><input data-company-field="operating_profit_eok" inputmode="decimal" placeholder="적자는 - 입력" value="${escapeHtml(currentRows[index]?.company?.operating_profit_eok || "")}"></label>
          <label><span>정상화 EBITDA · 억원</span><input data-company-field="ebitda_eok" inputmode="decimal" placeholder="있을 때만" value="${escapeHtml(currentRows[index]?.company?.ebitda_eok || "")}"></label>
          <label><span>현금 · 억원</span><input data-company-field="cash_eok" inputmode="decimal" placeholder="지분가치 계산용" value="${escapeHtml(currentRows[index]?.company?.cash_eok || "")}"></label>
          <label><span>이자부채 · 억원</span><input data-company-field="debt_eok" inputmode="decimal" placeholder="지분가치 계산용" value="${escapeHtml(currentRows[index]?.company?.debt_eok || "")}"></label>
          <label><span>브랜드 귀속매출 · 억원</span><input data-company-field="brand_revenue_eok" inputmode="decimal" placeholder="IP 평가용" value="${escapeHtml(currentRows[index]?.company?.brand_revenue_eok || "")}"></label>
          <label><span>비교 로열티율 · %</span><input data-company-field="royalty_rate_pct" inputmode="decimal" placeholder="계약 근거 필요" value="${escapeHtml(currentRows[index]?.company?.royalty_rate_pct || "")}"></label>
          <label><span>DART 고유번호</span><input data-company-field="corp_code" inputmode="numeric" maxlength="8" placeholder="선택 · 숫자 8자리" value="${escapeHtml(currentRows[index]?.company?.corp_code || "")}"></label>
          <label class="field-wide"><span>재무 출처 URL</span><input data-company-field="source_url" inputmode="url" placeholder="감사보고서·기업정보 링크" value="${escapeHtml(currentRows[index]?.company?.source_url || "")}"></label>
          <label class="document-check field-wide"><input type="checkbox" data-company-field="financial_document_verified"${currentRows[index]?.company?.financial_document_verified ? " checked" : ""}><span>재무제표·세무자료 원본과 대조한 입력값</span></label>
        </div>
        <p class="finance-caution">매출만 입력하면 넓은 EV 범위만 계산합니다. 현금과 부채까지 있어야 지분가치가 나오며, 계정·브랜드·회사가치는 합산하지 않습니다.</p>
      </details>
    </div>`).join("");
  updateQueueCount();
}

function updateQueueCount() {
  const filled = $$('[data-field="account"]', els.inputs).filter((input) => input.value.trim()).length;
  els.count.textContent = `${filled} / 8`;
  updateScanEstimate();
}

function addRow() {
  if (state.rowCount >= 8) {
    showToast("한 번에 최대 8개 계정까지 분석할 수 있습니다.");
    return;
  }
  const values = captureRows();
  state.rowCount += 1;
  renderInputRows(values);
  $$('[data-field="account"]', els.inputs).at(-1)?.focus();
}

function removeRow(index) {
  const values = captureRows();
  if (state.rowCount <= 1) {
    values[0] = { account: "", company: {} };
    renderInputRows(values);
    return;
  }
  values.splice(index, 1);
  state.rowCount -= 1;
  renderInputRows(values);
}

async function getHealth() {
  try {
    const response = await fetch(apiUrl("/api/health"), { cache: "no-store" });
    const payload = await response.json();
    state.health = payload.connection || {};
    const meta = Boolean(state.health.connected);
    const comments = Boolean(state.health.comment_provider_connected);
    els.connectionPill.classList.remove("connected", "disconnected");
    els.connectionPill.classList.add(meta && comments ? "connected" : "disconnected");
    els.connectionText.textContent = meta && comments
      ? `META + 댓글 실수집 연결됨`
      : meta ? "META 연결 · 댓글 토큰 필요" : "데이터 연결 필요";
    updateScanEstimate();
  } catch {
    els.connectionPill.classList.add("disconnected");
    els.connectionText.textContent = "서버 연결 확인";
  }
}

function showLoader(accountCount) {
  els.loader.hidden = false;
  els.progressBar.style.width = "2%";
  els.loaderTitle.textContent = "실데이터 분석 작업을 만드는 중";
  els.loaderDetail.textContent = `${accountCount}개 계정 · 공개 게시물과 댓글 작성자 수집`;
}

function updateLoader(job) {
  const titles = {
    queued: "분석 대기열에 등록했습니다",
    profile: "공개 게시물 지표를 분석하는 중",
    comments: "댓글 작성자 아이디를 실수집하는 중",
    comment_analysis: "반복 댓글러를 게시물별로 대조하는 중",
    complete: "인수 실사 보고서가 준비됐습니다",
    failed: "분석 작업을 완료하지 못했습니다",
  };
  els.progressBar.style.width = `${Math.max(2, Number(job.progress || 0))}%`;
  els.loaderTitle.textContent = titles[job.stage] || "실데이터 분석 중";
  els.loaderDetail.textContent = job.message || "잠시만 기다려 주세요.";
}

function hideLoader() {
  els.progressBar.style.width = "100%";
  window.setTimeout(() => { els.loader.hidden = true; }, 180);
}

function updateScanEstimate() {
  const mode = els.scanMode?.value || "quick";
  const accountCount = Math.max(1, $$('[data-field="account"]', els.inputs).filter((input) => input.value.trim()).length);
  const definition = state.health?.comment_scan_modes?.[mode];
  if (!definition) return;
  const maxUsd = Number(definition.estimated_max_usd || 0) * accountCount;
  els.scanEstimate.textContent = mode === "quick"
    ? `게시물당 최신 15댓글 실수집 · 무료 플랜 호환 · 계정 ${accountCount}개`
    : `최대 ${definition.posts * definition.per_post_limit * accountCount}댓글 · 예상 비용 상한 약 $${maxUsd.toFixed(2)} · 실행 전 재확인`;
}

function avatarMarkup(profile, className = "") {
  if (profile.avatar) {
    return `<img class="${className}" src="${escapeHtml(profile.avatar)}" alt="@${escapeHtml(profile.username)} 프로필" referrerpolicy="no-referrer">`;
  }
  return `<span class="avatar-fallback ${className}">${escapeHtml(profile.username.slice(0, 2).toUpperCase())}</span>`;
}

function sparklineSvg(points, username) {
  const values = points.map((point) => Number(point.value || 0));
  if (values.length < 2) return '<div class="post-placeholder">표본 부족</div>';
  const width = 420;
  const height = 82;
  const pad = 4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const coords = values.map((value, index) => {
    const x = pad + (index / (values.length - 1)) * (width - pad * 2);
    const y = height - pad - ((value - min) / span) * (height - pad * 2 - 7);
    return [x, y];
  });
  const line = coords.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${coords.at(-1)[0].toFixed(1)},${height} L${coords[0][0].toFixed(1)},${height} Z`;
  const gradientId = `spark-${username.replace(/[^a-z0-9]/g, "")}`;
  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="게시물 반응 추이">
    <defs><linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4457ff" stop-opacity=".22"/><stop offset="1" stop-color="#4457ff" stop-opacity="0"/></linearGradient></defs>
    <line class="baseline" x1="0" y1="${height - 1}" x2="${width}" y2="${height - 1}"/>
    <path class="area" fill="url(#${gradientId})" d="${area}"/><path class="line" d="${line}"/>
  </svg>`;
}

function evidenceMarkup(item) {
  return `<div class="evidence-row"><div>
    <label><span>${escapeHtml(item.label)}</span><b>${escapeHtml(item.value)}</b></label>
    <div class="bar"><i style="width:${Math.max(3, Math.min(100, item.score))}%"></i></div>
  </div></div>`;
}

function commentPanelMarkup(result) {
  const audit = result.repeat_commenters;
  if (audit.status !== "verified") {
    return `<div class="comment-empty">
      <strong>댓글 실수집을 완료하지 못했습니다.</strong>
      <p>${escapeHtml(audit.reason || "댓글 수집 제공자 연결을 확인해 주세요.")}</p>
      <span class="collection-code">${escapeHtml(audit.code || "collection_unavailable")}</span>
    </div>`;
  }
  const collection = audit.collection || {};
  const contamination = Number(audit.spam_comment_ratio || 0) >= 10 || Number(audit.duplicate_text_ratio || 0) >= 25
    ? `<p class="comment-warning"><strong>댓글 오염 경고</strong> 동일 문구 ${audit.duplicate_text_ratio}% · 스팸 패턴 ${audit.spam_comment_ratio || 0}% · 집중 유입 ${audit.burst_comment_ratio || 0}%</p>`
    : `<p class="comment-clean">동일 문구 ${audit.duplicate_text_ratio || 0}% · 스팸 패턴 ${audit.spam_comment_ratio || 0}%</p>`;
  const repeaters = audit.top_repeaters?.length
    ? `<div class="repeater-list">${audit.top_repeaters.slice(0, 10).map((person) => `<a class="repeater" href="https://instagram.com/${escapeHtml(person.username)}" target="_blank" rel="noreferrer"><strong>@${escapeHtml(person.username)}</strong><span>${person.posts}개 게시물 · ${person.comments}댓글 · ${person.share}% ↗</span></a>`).join("")}</div>`
    : '<div class="comment-empty"><strong>2개 이상 게시물에 반복 등장한 댓글러 없음</strong></div>';
  const firstRepeatedPost = audit.per_post?.findIndex((post) => Number(post.repeat_commenters) > 0) ?? -1;
  const perPost = audit.per_post?.length
    ? `<div class="post-audit-list"><h5>게시물별 반복 아이디</h5>${audit.per_post.map((post, index) => {
        const people = post.top_repeaters?.length
          ? post.top_repeaters.map((person) => `<a href="https://instagram.com/${escapeHtml(person.username)}" target="_blank" rel="noreferrer">@${escapeHtml(person.username)} <b>${person.comments_in_post}회</b></a>`).join("")
          : '<span class="no-repeat">이 표본에서 교차 반복 아이디 없음</span>';
        const coverage = post.coverage_ratio == null ? "수집률 계산 불가" : `표시 댓글 대비 ${post.coverage_ratio}%`;
        return `<details class="post-audit" ${index === (firstRepeatedPost >= 0 ? firstRepeatedPost : 0) ? "open" : ""}>
          <summary><span>POST ${String(index + 1).padStart(2, "0")}</span><strong>${post.repeat_commenters}명 반복</strong><em>${post.collected_comments}/${post.visible_comments || "?"}댓글 · ${coverage}</em></summary>
          <div>${people}${post.permalink ? `<a class="open-post" href="${escapeHtml(post.permalink)}" target="_blank" rel="noreferrer">게시물 열기 ↗</a>` : ""}</div>
        </details>`;
      }).join("")}</div>`
    : "";
  return `<div class="comment-audit">
    <div class="comment-kpis">
      <div><strong>${audit.repeat_author_ratio}%</strong><span>반복 작성자 비율</span></div>
      <div><strong>${audit.repeat_comment_share}%</strong><span>반복 댓글 점유</span></div>
      <div><strong>${audit.risk_label}</strong><span>댓글 패턴 위험</span></div>
      <div><strong>${collection.coverage_ratio == null ? "—" : `${collection.coverage_ratio}%`}</strong><span>표시 댓글 대비 수집률</span></div>
    </div>
    <p class="collection-note">${escapeHtml(collection.scan_label || "실수집")} · ${collection.posts_scanned || 0}/${collection.posts_requested || 0}개 게시물 · ${formatNumber(collection.collected_comments || audit.sample_comments)}댓글 · 최신순 표본 · 신뢰도 ${escapeHtml(audit.confidence || "제한적")}</p>
    ${contamination}${repeaters}${perPost}
  </div>`;
}

function postsMarkup(posts) {
  return posts.map((post) => `<a class="post-card" href="${escapeHtml(post.permalink)}" target="_blank" rel="noreferrer">
    ${post.thumbnail ? `<img src="${escapeHtml(post.thumbnail)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<span class="post-placeholder">미리보기 없음</span>'}
    <span class="post-meta"><b>♥ ${formatCompact(post.likes)}</b><b>◌ ${formatCompact(post.comments)}</b></span>
  </a>`).join("");
}

function valuationRange(layer, fallback = "자료 필요") {
  if (!layer || layer.low == null || layer.high == null) return fallback;
  return `${formatMoney(layer.low)} — ${formatMoney(layer.high)}`;
}

function companyValuationMarkup(result) {
  const valuation = result.company_valuation || {};
  const company = valuation.company || {};
  const ev = valuation.enterprise_value;
  const equity = valuation.equity_value;
  const brand = valuation.brand_value || {};
  const account = valuation.account_value || {
    low: result.deal.offer_low,
    high: result.deal.offer_high,
    ceiling: result.deal.ceiling,
  };
  const confidence = valuation.data_confidence || { score: 20, label: "공개 소셜만" };
  const readiness = valuation.transaction_readiness || { score: result.deal.score, verdict: "법인 자료 필요" };
  const scopeLabels = {
    auto: "거래범위 자동 비교",
    account_only: "계정 단독 인수",
    brand_assets: "브랜드·영업자산 인수",
    company_equity: "운영회사 지분 인수",
  };
  const sources = (valuation.sources || []).map((source) => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.label)} ↗</a>`).join("");
  const methodRows = ev?.methods?.length
    ? `<div class="valuation-methods">${ev.methods.map((method) => `<div><span>${escapeHtml(method.label)}</span><strong>${valuationRange(method)}</strong><small>${method.multiple_low}×–${method.multiple_high}× · ${escapeHtml(method.note)}</small></div>`).join("")}</div>`
    : "";
  const history = company.historical_financials?.length
    ? `<details class="financial-history"><summary>공개 과거 손익 보기</summary><div>${company.historical_financials.map((row) => `<p><b>${row.year}</b><span>매출 ${formatMoney(row.revenue_krw)}</span><span>영업이익 ${formatMoney(row.operating_profit_krw)}</span><span>순이익 ${formatMoney(row.net_income_krw)}</span></p>`).join("")}</div></details>`
    : "";
  const historicCheck = valuation.historical_crosscheck
    ? `<p class="historic-check"><strong>${valuation.historical_crosscheck.year} ${escapeHtml(valuation.historical_crosscheck.label)}</strong>${valuationRange(valuation.historical_crosscheck)} · ${escapeHtml(valuation.historical_crosscheck.warning)}</p>`
    : "";
  const special = (valuation.special_diligence || []).map((item) => `<a class="special-diligence" href="${escapeHtml(item.url || "#")}" target="_blank" rel="noreferrer"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.detail)}</span></a>`).join("");
  const mediaEconomics = company.media_economics
    ? `<a class="media-economics" href="${escapeHtml(company.media_economics.url)}" target="_blank" rel="noreferrer"><strong>공식 매체 경제성 ↗</strong><span>${escapeHtml(company.media_economics.note)}</span></a>`
    : "";
  return `<section class="company-panel">
    <div class="company-panel-head">
      <div><span class="section-index">BUSINESS VALUATION</span><h4>${escapeHtml(company.name || "운영회사 가치 미입력")}</h4><p>${escapeHtml(scopeLabels[valuation.requested_scope] || scopeLabels.auto)} · 계정과 회사의 거래 대상을 분리합니다.</p></div>
      <div class="readiness"><strong>${readiness.score}</strong><span>/ 5<br>${escapeHtml(readiness.verdict)}</span></div>
    </div>
    <div class="valuation-lanes">
      <article class="valuation-lane account-lane"><span>01 · ACCOUNT ONLY</span><h5>계정 단독 참고가</h5><strong>${valuationRange(account)}</strong><small>상한 ${formatMoney(account.ceiling)} · 회사 영업자산 제외</small></article>
      <article class="valuation-lane brand-lane"><span>02 · BRAND / IP</span><h5>브랜드·IP 가치</h5><strong>${brand.status === "indicative" ? valuationRange(brand) : "권리·로열티 자료 필요"}</strong><small>${escapeHtml(brand.method || brand.warning || "별도 권리 실사 필요")}</small></article>
      <article class="valuation-lane company-lane"><span>03 · ENTERPRISE VALUE</span><h5>운영회사 EV</h5><strong>${valuationRange(ev, "최근 재무 입력 필요")}</strong><small>${escapeHtml(ev?.method || "매출·영업이익·EBITDA 필요")}</small></article>
      <article class="valuation-lane equity-lane"><span>04 · EQUITY VALUE</span><h5>지분 인수가</h5><strong>${valuationRange(equity, "미산정")}</strong><small>${equity ? escapeHtml(equity.bridge) : "현금·차입금이 있어야 계산"}</small></article>
    </div>
    <div class="no-add-rule"><b>≠</b><p><strong>네 금액을 더하지 마세요.</strong> 계정만 살 때, 브랜드 자산을 살 때, 회사를 살 때의 서로 다른 거래 범위입니다. 회사 EV에는 계정과 브랜드가 만드는 현금흐름이 이미 들어갈 수 있습니다.</p></div>
    ${ev ? `<div class="financial-snapshot">
      <div><span>기준연도</span><strong>${company.fiscal_year || "—"}</strong></div>
      <div><span>매출</span><strong>${company.revenue_krw == null ? "미확인" : formatMoney(company.revenue_krw)}</strong></div>
      <div><span>영업이익</span><strong>${company.operating_profit_krw == null ? "미확인" : formatMoney(company.operating_profit_krw)}</strong></div>
      <div><span>정상화 EBITDA</span><strong>${company.ebitda_krw == null ? "미확인" : formatMoney(company.ebitda_krw)}</strong></div>
      <div><span>재무 신뢰도</span><strong>${confidence.score} / 100</strong><small>${escapeHtml(confidence.label)}</small></div>
    </div>` : `<div class="financial-missing"><strong>회사 가치 계산 대기</strong><span>위 입력창에서 법인명·매출·이익을 넣으면 계정 단독가와 분리된 EV를 계산합니다.</span></div>`}
    ${methodRows}${historicCheck}${history}${mediaEconomics}${special}
    <div class="valuation-bottom">
      <div><h5>핵심 경고</h5><ul>${(valuation.warnings || []).map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul></div>
      <details><summary>매도자에게 받을 실사자료 ${valuation.due_diligence?.length || 0}개</summary><ul>${(valuation.due_diligence || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></details>
    </div>
    ${company.source_note ? `<p class="company-source-note">${escapeHtml(company.source_note)}</p>` : ""}
    ${sources ? `<div class="valuation-sources">${sources}</div>` : ""}
  </section>`;
}

function accountReportMarkup(result) {
  const p = result.profile;
  const e = result.engagement;
  const a = result.algorithm;
  const auth = result.authenticity;
  const deal = result.deal;
  const business = result.company_valuation || {};
  const companyEv = business.enterprise_value;
  const scoreAngle = Math.round((deal.score / 5) * 360);
  const cacheLabel = result.cache?.captured_at
    ? `${result.cache.source === "live" ? "LIVE" : result.cache.stale ? "STALE CACHE" : "CACHE"} · ${new Date(result.cache.captured_at).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
    : "";
  return `<article class="account-report" id="report-${escapeHtml(result.username)}">
    <div class="report-top">
      <div class="profile-pane">
        <div class="profile-head">
          <div class="profile-identity">
            ${avatarMarkup(p, "profile-avatar")}
            <div><h3>${escapeHtml(p.name)}</h3><a href="https://instagram.com/${escapeHtml(p.username)}" target="_blank" rel="noreferrer">@${escapeHtml(p.username)} ↗</a>${cacheLabel ? `<small class="cache-stamp">${escapeHtml(cacheLabel)}</small>` : ""}</div>
          </div>
          <div class="profile-stats">
            <div><strong>${formatCompact(p.followers_count)}</strong><span>팔로워</span></div>
            <div><strong>${formatCompact(p.follows_count)}</strong><span>팔로잉</span></div>
            <div><strong>${formatCompact(p.media_count)}</strong><span>게시물</span></div>
          </div>
        </div>
        <p class="bio">${escapeHtml(p.biography || "프로필 소개가 없습니다.")}</p>
        <div class="topic-line"><span class="topic-main">${escapeHtml(result.content.primary)}</span><span class="topic-tag">${escapeHtml(result.content.secondary)}</span>${result.content.keywords.slice(0, 4).map((tag) => `<span class="topic-tag">${escapeHtml(tag)}</span>`).join("")}</div>
      </div>
      <aside class="price-pane">
        <div class="score-verdict">
          <div class="score-ring" style="--score-angle:${scoreAngle}deg"><strong>${deal.score}</strong><small>/ 5</small></div>
          <div class="verdict-copy"><span>BUYING VERDICT</span><h4>${escapeHtml(deal.verdict)}</h4></div>
        </div>
        <div class="price-range"><span>ACCOUNT-ONLY OFFER</span><strong>${formatMoney(deal.offer_low)} — ${formatMoney(deal.offer_high)}</strong><small>절대 상한 ${formatMoney(deal.ceiling)} · 회사·IP 제외</small></div>
        ${companyEv ? `<div class="company-price-callout"><span>OPERATING COMPANY EV</span><strong>${valuationRange(companyEv)}</strong><small>${escapeHtml(companyEv.method)} · 지분가는 순차입금 확인 후</small></div>` : ""}
      </aside>
    </div>

    <div class="metric-grid">
      <section class="metric-panel">
        <div class="panel-title"><h4>정제 평균 인게이지먼트</h4><span>${result.period.used}개 게시물 · 36h 성숙 필터</span></div>
        <div class="big-metric"><strong>${e.rate.toFixed(e.rate < 1 ? 3 : 2)}</strong><span>% ER</span></div>
        <p class="metric-comparison">동일 규모 내부 기준 <b>${e.benchmark}%</b> · 상하위 이상치 제거 평균</p>
        <div class="sparkline">${sparklineSvg(e.sparkline, result.username)}</div>
        <div class="mini-metrics"><div><strong>${formatCompact(e.avg_likes)}</strong><span>평균 좋아요</span></div><div><strong>${formatCompact(e.avg_comments)}</strong><span>평균 댓글</span></div><div><strong>${formatCompact(e.median_engagement)}</strong><span>중앙 반응</span></div></div>
      </section>
      <section class="metric-panel">
        <div class="panel-title"><h4>알고리즘 활력</h4><span>공개 지표 프록시</span></div>
        <div class="algo-score"><strong>${a.score}</strong><span>${escapeHtml(a.label)}</span></div>
        <div class="evidence-list">${a.evidence.map(evidenceMarkup).join("")}</div>
        <p class="deal-note">${escapeHtml(a.note)}</p>
      </section>
      <section class="metric-panel">
        <div class="panel-title"><h4>허수 · 진정성 신호</h4><span>신뢰도 ${auth.confidence}</span></div>
        <div class="auth-summary"><strong>${auth.score}</strong><span>${escapeHtml(auth.label)}</span></div>
        <div class="signal-list">${auth.signals.slice(0, 4).map((signal) => `<div class="signal ${escapeHtml(signal.level)}"><span class="signal-dot"></span><div><strong>${escapeHtml(signal.title)}</strong><small>${escapeHtml(signal.detail)}</small></div></div>`).join("")}</div>
      </section>
      <section class="metric-panel">
        <div class="panel-title"><h4>반복 댓글러 분석</h4><span>${result.repeat_commenters.status === "verified" ? `${formatNumber(result.repeat_commenters.sample_comments)}개 실제 댓글 확인` : "댓글 실수집 확인 필요"}</span></div>
        ${commentPanelMarkup(result)}
      </section>
      ${companyValuationMarkup(result)}
      <section class="deal-panel">
        <div class="deal-layout">
          <div>
            <div class="panel-title"><h4>최종 인수 판단</h4><span>${deal.score_100} / 100</span></div>
            <p class="deal-action">${escapeHtml(deal.action)}</p>
            <p class="deal-note">${escapeHtml(deal.basis)}</p>
          </div>
          <div class="component-bars">${deal.components.map((component) => `<div class="evidence-row"><div><label><span>${escapeHtml(component.label)}</span><b>${component.score}</b></label><div class="bar"><i style="width:${component.score}%; background:${component.score >= 70 ? "#1f8f59" : component.score >= 50 ? "#4457ff" : "#c83f32"}"></i></div></div></div>`).join("")}</div>
          <div class="terms-line"><b>!</b><span>${escapeHtml(deal.terms_risk)}</span></div>
        </div>
      </section>
    </div>
    <div class="post-strip"><h4>분석 게시물 미리보기</h4><div class="post-grid">${postsMarkup(result.posts)}</div></div>
  </article>`;
}

function comparisonMarkup(results) {
  const rows = results.map((result) => {
    if (result.status !== "ok") {
      return `<div class="compare-row"><div class="compare-profile"><span class="avatar-fallback">!</span><div><strong>@${escapeHtml(result.username)}</strong><small>조회 실패</small></div></div><div class="compare-error">—</div><div class="compare-error">${escapeHtml(result.message)}</div><div>—</div><div>—</div><div>—</div><div>—</div></div>`;
    }
    const companyEv = result.company_valuation?.enterprise_value;
    return `<div class="compare-row">
      <div class="compare-profile">${avatarMarkup(result.profile)}<div><strong>@${escapeHtml(result.username)}</strong><small>${formatCompact(result.profile.followers_count)} followers</small></div></div>
      <div class="compare-score">${result.deal.score} / 5</div>
      <div><span class="compare-verdict ${result.deal.tone}">${escapeHtml(result.deal.verdict)}</span></div>
      <div><strong>${result.engagement.rate.toFixed(result.engagement.rate < 1 ? 3 : 2)}%</strong></div>
      <div><strong>${result.algorithm.score}</strong> · ${escapeHtml(result.algorithm.label)}</div>
      <div><strong>${formatMoney(result.deal.offer_low)}</strong> — ${formatMoney(result.deal.offer_high)}</div>
      <div class="compare-company"><strong>${companyEv ? valuationRange(companyEv) : "재무 필요"}</strong><small>${companyEv ? "EV · 지분가 아님" : "계정가와 별도"}</small></div>
    </div>`;
  }).join("");
  return `<div class="comparison"><div class="compare-row compare-head"><span>계정</span><span>추천 점수</span><span>판정</span><span>정제 ER</span><span>알고리즘</span><span>계정 단독가</span><span>운영회사 EV</span></div>${rows}</div>`;
}

function renderResults() {
  els.resultsSection.hidden = false;
  els.comparison.innerHTML = comparisonMarkup(state.results);
  els.resultStack.innerHTML = state.results.map((result) => result.status === "ok"
    ? accountReportMarkup(result)
    : `<article class="error-report"><strong>@${escapeHtml(result.username)} 분석 실패</strong><p>${escapeHtml(result.message)}</p></article>`).join("");
  const successful = state.results.filter((result) => result.status === "ok").length;
  const analyzedPosts = Math.max(
    0,
    ...state.results
      .filter((result) => result.status === "ok")
      .map((result) => Number(result.period?.used || 0)),
  );
  const timestamp = state.generatedAt ? new Date(state.generatedAt).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" }) : "";
  els.reportMeta.innerHTML = `<strong>${successful}개 계정 분석 완료</strong><br>${escapeHtml(timestamp)}${analyzedPosts ? ` · 최근 ${analyzedPosts}개 기준` : ""}`;
  els.resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function collectCompanyContexts() {
  return captureRows()
    .filter((row) => row.account.trim())
    .map((row) => ({ account: row.account.trim(), ...row.company }));
}

async function analyze(accounts, companyContexts) {
  const scanMode = els.scanMode.value;
  const definition = state.health?.comment_scan_modes?.[scanMode];
  let confirmPaid = false;
  if (definition?.paid_confirmation) {
    const maxCost = Number(definition.estimated_max_usd || 0) * accounts.length;
    confirmPaid = window.confirm(
      `${definition.label} 모드는 최대 ${definition.posts * definition.per_post_limit * accounts.length}개 댓글을 요청합니다.\n` +
      `현재 공개 단가 기준 비용 상한 추정치는 약 $${maxCost.toFixed(2)}입니다. 계속할까요?`
    );
    if (!confirmPaid) return;
  }
  showLoader(accounts.length);
  els.analyze.disabled = true;
  try {
    const response = await fetch(apiUrl("/api/jobs"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accounts,
        scan_mode: scanMode,
        confirm_paid: confirmPaid,
        force_refresh: els.forceRefresh.checked,
        company_contexts: companyContexts,
      }),
    });
    let job = await response.json();
    if (!response.ok) throw new Error(job.message || "분석 요청을 처리하지 못했습니다.");
    state.currentJob = job.id;
    const deadline = Date.now() + 20 * 60 * 1000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => window.setTimeout(resolve, 1400));
      const jobResponse = await fetch(apiUrl(`/api/jobs/${encodeURIComponent(job.id)}`), { cache: "no-store" });
      job = await jobResponse.json();
      if (!jobResponse.ok) throw new Error(job.message || "분석 작업 상태를 읽지 못했습니다.");
      updateLoader(job);
      if (job.status === "failed") throw new Error(job.error?.message || "분석 작업을 완료하지 못했습니다.");
      if (job.status === "completed") break;
    }
    if (job.status !== "completed") throw new Error("분석 시간이 20분을 넘었습니다. 같은 작업을 잠시 후 다시 확인해 주세요.");
    const payload = job.result || {};
    state.results = payload.results || [];
    state.generatedAt = payload.generated_at;
    renderResults();
    const failed = state.results.filter((result) => result.status !== "ok").length;
    if (job.warning) {
      showToast(`프로필 분석 완료 · 댓글: ${job.warning.message}`);
    } else {
      showToast(failed ? `${state.results.length - failed}개 완료 · ${failed}개 확인 필요` : `${state.results.length}개 계정 실데이터 분석이 완료됐습니다.`);
    }
  } catch (error) {
    showToast(error.message || "분석 서버에 연결하지 못했습니다.");
  } finally {
    state.currentJob = null;
    hideLoader();
    els.analyze.disabled = false;
  }
}

function discoveryImageUrl(item) {
  return item.image_url || `https://raw.githubusercontent.com/jhkim-lgtm/magazine-hub/main/img/${encodeURIComponent(item.username)}.jpg`;
}

function discoveryRange(valuation) {
  return `${formatMoney(valuation.low)} — ${formatMoney(valuation.high)}`;
}

function discoveryChangeLabel(change) {
  if (change == null || Math.abs(Number(change)) < 3) return "기존 중앙값과 유사";
  return `기존 중앙값 대비 ${Number(change) > 0 ? "+" : "−"}${Math.abs(Number(change))}%`;
}

function discoveryScopeSources(item) {
  const sources = [...(item.scope_sources || [])];
  if (item.company_valuation?.source_url && !sources.some((source) => source.url === item.company_valuation.source_url)) {
    sources.push({ label: "매출·EV 근거", url: item.company_valuation.source_url });
  }
  if (!sources.length) return "";
  return `<div class="discovery-scope-sources">${sources.map((source) => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.label)} ↗</a>`).join("")}</div>`;
}

function discoveryCardMarkup(item) {
  const valuation = item.valuation || {};
  const companyRequired = ["company_financials_required", "company_revenue_only"].includes(valuation.scope_status);
  const companyValued = valuation.scope_status === "company_revenue_only" && valuation.enterprise_value;
  const notAcquirable = valuation.scope_status === "not_acquirable";
  const personal = valuation.scope_status === "personal_rights_required";
  const previous = valuation.previous_low && valuation.previous_high
    ? `${formatMoney(valuation.previous_low)} — ${formatMoney(valuation.previous_high)}`
    : "기존가 없음";
  const name = item.display_name || item.content_summary || `@${item.username}`;
  const scopeClass = notAcquirable ? "not-acquirable" : companyRequired ? "company-required" : personal ? "personal-required" : "account-preliminary";
  const leadValue = notAcquirable
    ? `<div class="company-value-missing blocked"><span>NON-TRANSFERABLE OFFICIAL CHANNEL</span><strong>인수 탐색 제외</strong><em>공공·비영리 운영주체 공식 계정 · 거래가 미산정</em></div>`
    : companyValued
      ? `<div class="company-value-missing valued"><span>OPERATING COMPANY EV · REVENUE ONLY</span><strong>${discoveryRange(valuation.enterprise_value)}</strong><em>${escapeHtml(item.company_valuation?.method || "순차입금 확인 전 EV 참고범위")} · 지분가 미산정 · 회사자료 ${formatNumber(item.company_valuation?.confidence?.score || 0)}/100</em></div>`
      : companyRequired
        ? `<div class="company-value-missing"><span>BRAND / OPERATING COMPANY</span><strong>운영회사·브랜드 인수</strong><em>재무자료 필요 · EV/지분가 미산정</em></div>`
    : `<div class="discovery-price"><span>${escapeHtml(valuation.price_label || "계정 단독 예비가")}</span><strong>${discoveryRange(valuation)}</strong><small>실사 전 상한 ${formatMoney(valuation.ceiling)}</small></div>`;
  const accountContribution = companyRequired && !notAcquirable && valuation.low != null && valuation.high != null
    ? `<div class="discovery-price secondary"><span>${escapeHtml(valuation.price_label)}</span><strong>${discoveryRange(valuation)}</strong><small>회사가에 더하지 말 것 · 상한 ${formatMoney(valuation.ceiling)}</small></div>`
    : companyRequired && valuation.status === "profile_scale_unavailable"
      ? `<div class="discovery-price secondary unavailable"><span>ACCOUNT COMPONENT</span><strong>현재 규모 재조회 필요</strong><small>0원으로 계산하지 않음 · 회사/브랜드 인수가와 별도</small></div>`
      : "";
  const social = item.live_social_audit;
  const socialMarkup = social ? `<div class="discovery-live-audit"><b>LIVE SOCIAL AUDIT</b><span>ER ${formatNumber(social.engagement_rate)}%</span><span>알고리즘 ${formatNumber(social.algorithm_score)}</span><span>진정성 ${formatNumber(social.authenticity_score)}</span><small>${formatNumber(social.posts_used)}개 분석 · ${social.comment_status === "verified" ? `댓글 ${formatNumber(social.comment_sample)}개` : "반복 댓글러 미수집"}</small></div>` : "";
  return `<article class="discovery-card ${scopeClass}${item.featured ? " featured-magazine" : ""}" data-username="${escapeHtml(item.username)}">
    ${item.featured ? `<div class="featured-ribbon"><span>SCOUT 100</span><strong>유명 매거진 벤치마크</strong></div>` : ""}
    <div class="discovery-card-top">
      <div class="discovery-avatar">
        <span>${escapeHtml(item.username.slice(0, 2).toUpperCase())}</span>
        <img src="${escapeHtml(discoveryImageUrl(item))}" alt="" loading="lazy" referrerpolicy="no-referrer">
      </div>
      <div class="discovery-identity"><h3>${escapeHtml(name)}</h3><a href="https://www.instagram.com/${escapeHtml(item.username)}/" target="_blank" rel="noreferrer">@${escapeHtml(item.username)} ↗</a></div>
      <div class="discovery-followers"><strong>${formatCompact(social?.followers || item.followers)}</strong><span>${social ? "LIVE FOLLOWERS" : "FOLLOWERS"}</span></div>
    </div>
    <div class="discovery-tags">${item.featured ? "<span class=\"featured-tag\">FEATURED</span>" : ""}<span>${escapeHtml(item.category)}</span><span>${escapeHtml(item.account_type)}</span><span>${escapeHtml(item.market)}</span><i>${item.follower_source === "api" ? "META 현재값" : "WEB 근사"}</i></div>
    <p class="discovery-content">${escapeHtml(item.content_summary || "콘텐츠 설명 없음")}</p>
    <p class="discovery-operator">${escapeHtml(item.operator_note || "운영주체 확인 필요")}</p>
    ${socialMarkup}${leadValue}${accountContribution}
    <div class="legacy-price"><span>기존 허브 추정</span><s>${escapeHtml(previous)}</s><b>${escapeHtml(notAcquirable ? "인수가로 표시하지 않음" : discoveryChangeLabel(valuation.change_pct))}</b></div>
    <div class="discovery-scope-warning"><strong>${escapeHtml(valuation.scope_label || "계정 단독")}</strong><p>${escapeHtml(valuation.scope_warning || "")}</p></div>
    ${discoveryScopeSources(item)}
    <div class="discovery-confidence"><div><span>구매추천</span><strong>${valuation.buy_score == null ? "—" : formatNumber(valuation.buy_score)} / 5</strong></div><div><span>가격 신뢰도</span><strong>${valuation.confidence?.score || 0} / 100</strong></div><p>${escapeHtml(valuation.buy_verdict || "정밀 실사 전 판정 보류")}</p></div>
    <div class="discovery-card-actions">
      <button type="button" data-audit-candidate="${escapeHtml(item.username)}">50개 게시물 정밀 판독</button>
      <a href="https://www.instagram.com/${escapeHtml(item.username)}/" target="_blank" rel="noreferrer">프로필 확인 ↗</a>
    </div>
  </article>`;
}

function discoveryFilteredItems() {
  const discovery = state.discovery;
  const query = discovery.search.trim().toLocaleLowerCase("ko-KR");
  const filtered = discovery.items.filter((item) => {
    if (discovery.featuredOnly && !item.featured) return false;
    if (discovery.category !== "all" && item.category !== discovery.category) return false;
    if (discovery.type !== "all" && item.account_type !== discovery.type) return false;
    if (discovery.market !== "all" && item.market !== discovery.market) return false;
    if (!query) return true;
    return [item.username, item.display_name, item.content_summary, item.operator_note, item.category]
      .join(" ").toLocaleLowerCase("ko-KR").includes(query);
  });
  const midpoint = (item) => Number(item.valuation?.midpoint || 0);
  filtered.sort((a, b) => {
    if (discovery.sort === "featured_desc") {
      const featured = Number(Boolean(b.featured)) - Number(Boolean(a.featured));
      if (featured) return featured;
      return Number(b.followers || 0) - Number(a.followers || 0);
    }
    if (discovery.sort === "price_desc") return midpoint(b) - midpoint(a);
    if (discovery.sort === "price_asc") return midpoint(a) - midpoint(b);
    if (discovery.sort === "change_asc") return Number(a.valuation?.change_pct || 0) - Number(b.valuation?.change_pct || 0);
    if (discovery.sort === "name") return a.username.localeCompare(b.username);
    return Number(b.followers || 0) - Number(a.followers || 0);
  });
  return filtered;
}

function renderDiscoveryCatalog(resetCount = false) {
  if (resetCount) state.discovery.visibleCount = 24;
  const filtered = discoveryFilteredItems();
  const shown = filtered.slice(0, state.discovery.visibleCount);
  els.discoveryGrid.classList.toggle("list-view", state.discovery.view === "list");
  els.discoveryGrid.innerHTML = shown.length
    ? shown.map(discoveryCardMarkup).join("")
    : `<div class="discovery-empty"><strong>조건에 맞는 후보가 없습니다.</strong><p>검색어나 필터를 바꿔보세요.</p></div>`;
  els.discoveryResultCount.textContent = `${formatNumber(filtered.length)}개 후보`;
  els.discoveryLoadMore.hidden = shown.length >= filtered.length;
  els.discoveryLoadMore.textContent = `더 보기 · ${formatNumber(filtered.length - shown.length)}개 남음`;
}

function renderDiscoveryFilters() {
  const categories = Object.entries(state.discovery.stats.categories || {});
  els.discoveryCategoryFilters.innerHTML = [
    `<button type="button" class="featured-filter${state.discovery.featuredOnly ? " active" : ""}" data-discovery-featured="true">SCOUT 100 <b>${formatNumber(state.discovery.stats.featured_magazines || 0)}</b></button>`,
    `<button type="button" class="active" data-discovery-category="all">전체 <b>${formatNumber(state.discovery.items.length)}</b></button>`,
    ...categories.map(([category, count]) => `<button type="button" data-discovery-category="${escapeHtml(category)}">${escapeHtml(category)} <b>${formatNumber(count)}</b></button>`),
  ].join("");
  const optionMarkup = (values) => Object.keys(values || {}).map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)} · ${formatNumber(values[value])}</option>`).join("");
  els.discoveryType.innerHTML = `<option value="all">전체 유형</option>${optionMarkup(state.discovery.stats.types)}`;
  els.discoveryMarket.innerHTML = `<option value="all">전체 시장</option>${optionMarkup(state.discovery.stats.markets)}`;
}

function renderDiscoverySummary() {
  const stats = state.discovery.stats;
  const fetched = state.discovery.meta.source_fetched_at
    ? new Date(state.discovery.meta.source_fetched_at).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" })
    : "시간 미확인";
  els.discoveryStats.innerHTML = `
    <div><span>탐색 후보</span><strong>${formatNumber(stats.accounts)}</strong><small>유명 매거진 ${formatNumber(stats.featured_magazines)} · 현재 규모 ${formatNumber(stats.featured_profiles_current)} (Meta ${formatNumber(stats.featured_profiles_api_exact)})</small></div>
    <div><span>재산정</span><strong>${formatNumber(stats.repriced)}</strong><small>상향 ${formatNumber(stats.raised)} · 하향 ${formatNumber(stats.lowered)}</small></div>
    <div><span>회사·기관</span><strong>${formatNumber(stats.company_financials_required)}</strong><small>재무필요 · 비거래 ${formatNumber(stats.not_acquirable)}</small></div>
    <div><span>50개 실사 완료</span><strong>0</strong><small>전체 판정 보류</small></div>`;
  els.discoveryTabCount.textContent = formatNumber(stats.accounts);
  els.discoveryMeta.textContent = `원본 ${formatNumber(stats.accounts)}개 · 시세 기준 ${state.discovery.meta.pricing_as_of} · 원본 동기화 ${fetched}`;
}

async function loadDiscovery(forceRefresh = false) {
  if ((state.discovery.loaded && !forceRefresh) || state.discovery.loading) return;
  state.discovery.loading = true;
  els.discoveryGrid.innerHTML = `<div class="discovery-loading"><span></span><strong>후보와 거래 범위를 재분류하는 중</strong></div>`;
  if (els.refreshDiscovery) els.refreshDiscovery.disabled = true;
  try {
    const response = await fetch(apiUrl(`/api/discovery${forceRefresh ? "?refresh=1" : ""}`), { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || "탐색 허브를 불러오지 못했습니다.");
    state.discovery.items = payload.items || [];
    state.discovery.stats = payload.stats || {};
    state.discovery.meta = payload.meta || {};
    state.discovery.loaded = true;
    renderDiscoveryFilters();
    renderDiscoverySummary();
    renderDiscoveryCatalog(true);
    if (forceRefresh) showToast(`${formatNumber(state.discovery.items.length)}개 원본과 현재 가격을 다시 맞춰습니다.`);
  } catch (error) {
    els.discoveryGrid.innerHTML = `<div class="discovery-empty error"><strong>탐색 허브를 불러오지 못했습니다.</strong><p>${escapeHtml(error.message)}</p></div>`;
    showToast(error.message || "탐색 허브 연결을 확인해 주세요.");
  } finally {
    state.discovery.loading = false;
    if (els.refreshDiscovery) els.refreshDiscovery.disabled = false;
  }
}

function switchAppTab(tab, updateUrl = true) {
  const next = tab === "discovery" ? "discovery" : "audit";
  state.activeTab = next;
  els.auditView.hidden = next !== "audit";
  els.discoveryView.hidden = next !== "discovery";
  els.appTabs.forEach((button) => {
    const active = button.dataset.appTab === next;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  document.title = next === "discovery"
    ? "SCOUT/IG Discovery — Instagram Acquisition Hub"
    : "SCOUT/IG — Instagram Acquisition Audit";
  if (updateUrl) {
    const url = new URL(window.location.href);
    if (next === "discovery") url.searchParams.set("tab", "discovery");
    else url.searchParams.delete("tab");
    url.hash = "";
    window.history.replaceState({}, "", url);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  if (next === "discovery") loadDiscovery();
}

function queueDiscoveryCandidate(username) {
  const values = captureRows();
  let target = values.findIndex((row) => !row.account.trim());
  if (target < 0 && state.rowCount < 8) {
    target = values.length;
    values.push({ account: "", company: {} });
    state.rowCount += 1;
  }
  if (target < 0) {
    showToast("판독 대기열이 가득 찼습니다. 기존 계정 하나를 비워 주세요.");
    return;
  }
  values[target] = { account: `https://www.instagram.com/${username}/`, company: {} };
  renderInputRows(values);
  els.scanMode.value = "deep";
  updateScanEstimate();
  switchAppTab("audit");
  window.setTimeout(() => {
    $(".audit-console")?.scrollIntoView({ behavior: "smooth", block: "center" });
    $$('[data-field="account"]', els.inputs)[target]?.focus();
  }, 180);
  showToast(`@${username}을 50개 게시물 정밀 판독에 넣었습니다.`);
}

els.inputs.addEventListener("input", updateQueueCount);
els.inputs.addEventListener("click", (event) => {
  const button = event.target.closest(".remove-row");
  if (button) removeRow(Number(button.dataset.index));
});
els.add.addEventListener("click", addRow);
els.sample.addEventListener("click", () => {
  state.rowCount = 3;
  renderInputRows(["https://instagram.com/eyesmag", "https://instagram.com/dailyfashion_news", "https://instagram.com/_tripgoing"]);
  showToast("실데이터로 확인할 샘플 계정 3개를 불러왔습니다.");
});
els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const accounts = $$('[data-field="account"]', els.inputs).map((input) => input.value.trim()).filter(Boolean);
  if (!accounts.length) { showToast("분석할 계정을 한 개 이상 입력해 주세요."); return; }
  analyze(accounts, collectCompanyContexts());
});
els.hideLoader.addEventListener("click", () => { els.loader.hidden = true; });
els.scanMode.addEventListener("change", updateScanEstimate);
els.appTabs.forEach((button) => button.addEventListener("click", () => switchAppTab(button.dataset.appTab)));
els.refreshDiscovery?.addEventListener("click", () => loadDiscovery(true));
els.discoverySearch?.addEventListener("input", (event) => {
  state.discovery.search = event.target.value;
  renderDiscoveryCatalog(true);
});
els.discoveryCategoryFilters?.addEventListener("click", (event) => {
  const featuredButton = event.target.closest("[data-discovery-featured]");
  if (featuredButton) {
    state.discovery.featuredOnly = !state.discovery.featuredOnly;
    featuredButton.classList.toggle("active", state.discovery.featuredOnly);
    renderDiscoveryCatalog(true);
    return;
  }
  const button = event.target.closest("[data-discovery-category]");
  if (!button) return;
  state.discovery.category = button.dataset.discoveryCategory;
  $$('[data-discovery-category]', els.discoveryCategoryFilters).forEach((candidate) => candidate.classList.toggle("active", candidate === button));
  renderDiscoveryCatalog(true);
});
els.discoveryType?.addEventListener("change", (event) => {
  state.discovery.type = event.target.value;
  renderDiscoveryCatalog(true);
});
els.discoveryMarket?.addEventListener("change", (event) => {
  state.discovery.market = event.target.value;
  renderDiscoveryCatalog(true);
});
els.discoverySort?.addEventListener("change", (event) => {
  state.discovery.sort = event.target.value;
  renderDiscoveryCatalog(true);
});
els.discoveryViewButtons.forEach((button) => button.addEventListener("click", () => {
  state.discovery.view = button.dataset.discoveryView;
  els.discoveryViewButtons.forEach((candidate) => candidate.classList.toggle("active", candidate === button));
  renderDiscoveryCatalog();
}));
els.discoveryGrid?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-audit-candidate]");
  if (button) queueDiscoveryCandidate(button.dataset.auditCandidate);
});
els.discoveryLoadMore?.addEventListener("click", () => {
  state.discovery.visibleCount += 24;
  renderDiscoveryCatalog();
});
document.addEventListener("error", (event) => {
  if (event.target.matches?.(".discovery-avatar img")) event.target.hidden = true;
}, true);
window.addEventListener("popstate", () => switchAppTab(new URL(window.location.href).searchParams.get("tab"), false));

async function boot() {
  renderInputRows();
  await resolvePublicApiBase();
  getHealth();
  switchAppTab(new URL(window.location.href).searchParams.get("tab"), false);
}

boot();
