import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  RULES_2026,
  calculateSalary,
  formatKRW,
  formatManwon,
  makeSalaryRows,
  salaryLabelFromManwon
} from "../src/calc.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const site = {
  name: "연봉 실수령액표",
  origin: "https://www.mysalary.kr",
  adsenseClient: "ca-pub-0000000000000000"
};

const rows = makeSalaryRows();
const popularSalaries = [
  2400, 3000, 3200, 3500, 3600, 4000, 4500, 5000, 6000, 7000, 8000, 9000,
  10000, 12000, 15000, 20000
];
const popularSalarySet = new Set(popularSalaries);
const intervalStarts = [];
for (let start = 2000; start < 100000; start += 1000) intervalStarts.push(start);

function routePath(route) {
  if (route === "/") return path.join(dist, "index.html");
  return path.join(dist, route.replace(/^\//, ""), "index.html");
}

async function writePage(route, html) {
  const filePath = routePath(route);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, html);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function canonical(route) {
  return `${site.origin}${route === "/" ? "" : route}`;
}

function salaryHref(manwon) {
  if (popularSalarySet.has(manwon)) return `/salary/2026/${manwon}`;
  const start = Math.min(99000, Math.max(2000, Math.floor(manwon / 1000) * 1000));
  return `/salary/2026/${start}-${start + 1000}`;
}

function salaryRangeLabel(startManwon, endManwon) {
  return `${salaryLabelFromManwon(startManwon)}~${salaryLabelFromManwon(endManwon)}`;
}

function salaryTableLabel(manwon) {
  return salaryLabelFromManwon(manwon).replaceAll(" 원", "");
}

function salaryGroupStart(manwon) {
  return Math.min(99000, Math.max(2000, Math.floor(manwon / 1000) * 1000));
}

const deductionMeta = [
  ["nationalPension", "국민연금", "노후연금 재원으로 공제되는 금액"],
  ["healthInsurance", "건강보험", "건강보험료 중 근로자 부담분"],
  ["longTermCare", "장기요양", "건강보험료에 연동되는 장기요양보험료"],
  ["employmentInsurance", "고용보험", "실업급여 재원 중 근로자 부담분"],
  ["incomeTax", "근로소득세", "국세청 간이세액표 기준 원천징수 소득세"],
  ["localIncomeTax", "지방소득세", "근로소득세의 10%"]
];

function minusKRW(value) {
  return value > 0 ? `-${formatKRW(value)}` : "0원";
}

function formatPercent(value, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

function formatIncrease(value) {
  if (value == null) return "-";
  return value > 0 ? `+${formatKRW(value)}` : formatKRW(value);
}

function rowDeductions(row) {
  return row.deductions || {
    nationalPension: row.nationalPension,
    healthInsurance: row.healthInsurance,
    longTermCare: row.longTermCare,
    employmentInsurance: row.employmentInsurance,
    incomeTax: row.incomeTax,
    localIncomeTax: row.localIncomeTax
  };
}

function pageLayout({
  route,
  title,
  description,
  h1,
  intro,
  body,
  jsonLd,
  noIndex = false
}) {
  const adScript =
    site.adsenseClient && !site.adsenseClient.includes("000000")
      ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${site.adsenseClient}" crossorigin="anonymous"></script>`
      : "";
  const robots = noIndex ? "noindex,follow" : "index,follow";
  const structured = jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`
    : "";

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="${robots}">
  <link rel="canonical" href="${canonical(route)}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${canonical(route)}">
  <link rel="stylesheet" href="/assets/styles.css">
  ${adScript}
  ${structured}
</head>
<body>
  <header class="site-header">
    <a class="brand" href="/">연봉 실수령액표</a>
    <nav aria-label="주요 메뉴">
      <a href="/salary/2026">전체표</a>
      <a href="/calculator">계산기</a>
      <a href="/guide/2026">계산 기준</a>
    </nav>
  </header>
  <main>
    <section class="hero">
      <div>
        <p class="eyebrow">2026년 기준</p>
        <h1>${h1}</h1>
        <p class="intro">${intro}</p>
      </div>
      <div class="quick-calc" id="quick-calculator">
        <label for="quickSalary">세전 연봉</label>
        <div class="input-row">
          <input id="quickSalary" type="number" min="2000" max="100000" step="100" value="3000" inputmode="numeric">
          <span>만 원</span>
        </div>
        <output id="quickResult">계산 중</output>
      </div>
    </section>
    <div class="ad-slot" aria-label="광고 영역">AdSense 광고 영역</div>
    ${body}
  </main>
  <footer>
    <p>본 사이트의 금액은 ${RULES_2026.assumptionLabel}의 예상치입니다. 회사 급여 규정, 비과세 항목, 부양가족, 원천징수 비율, 연말정산 결과에 따라 실제 금액은 달라질 수 있습니다.</p>
    <p>세무 판단이 필요한 경우 국세청, 국민연금공단, 국민건강보험공단, 고용보험 안내를 함께 확인하세요.</p>
  </footer>
  <script type="module" src="/assets/calculator.js"></script>
</body>
</html>`;
}

function table(rowsToRender, { compact = false, grouped = !compact } = {}) {
  const headerCells = `<th>연봉</th>
          <th>월세전</th>
          <th>국민</th>
          <th>건강</th>
          <th>요양</th>
          <th>고용</th>
          <th>소득세</th>
          <th>지방세</th>
          <th>공제합</th>
          <th>월실수령</th>
          ${compact ? "" : "<th>연실수령</th>"}`;
  const rowHtml = (row) => {
    const deductions = rowDeductions(row);
    const summary = `연봉 ${salaryLabelFromManwon(row.manwon)}: 월 세전 ${formatKRW(row.grossMonthly)}에서 총 ${minusKRW(row.totalDeductionMonthly)} 공제, 월 실수령 ${formatKRW(row.netMonthly)}`;

    return `<tr class="salary-row" title="${escapeHtml(summary)}">
      <th scope="row"><a href="${salaryHref(row.manwon)}" title="${salaryLabelFromManwon(row.manwon)}">${salaryTableLabel(row.manwon)}</a></th>
      <td>${formatKRW(row.grossMonthly)}</td>
      <td class="negative">${minusKRW(deductions.nationalPension)}</td>
      <td class="negative">${minusKRW(deductions.healthInsurance)}</td>
      <td class="negative">${minusKRW(deductions.longTermCare)}</td>
      <td class="negative">${minusKRW(deductions.employmentInsurance)}</td>
      <td class="negative">${minusKRW(deductions.incomeTax)}</td>
      <td class="negative">${minusKRW(deductions.localIncomeTax)}</td>
      <td class="negative"><strong>${minusKRW(row.totalDeductionMonthly)}</strong></td>
      <td><strong>${formatKRW(row.netMonthly)}</strong></td>
      ${compact ? "" : `<td>${formatKRW(row.netAnnual)}</td>`}
    </tr>`;
  };
  const tableBlock = (body) => `<div class="table-wrap">
    <table>
      <thead>
        <tr>
          ${headerCells}
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  </div>`;

  if (grouped) {
    const groups = [];
    for (const row of rowsToRender) {
      const groupStart = salaryGroupStart(row.manwon);
      const latest = groups.at(-1);
      if (!latest || latest.groupStart !== groupStart) groups.push({ groupStart, rows: [] });
      groups.at(-1).rows.push(row);
    }

    return groups
      .map((group, index) => {
        const ad = index === 0 ? "" : `<div class="table-ad-slot">AdSense 광고 영역</div>`;
        return `${ad}${tableBlock(group.rows.map(rowHtml).join(""))}`;
      })
      .join("");
  }

  const body = rowsToRender
    .map((row) => {
      return rowHtml(row);
    })
    .join("");

  return tableBlock(body);
}

function summaryCards(items) {
  return `<section class="metrics">${items
    .map(
      (item) => `<article>
        <span>${item.label}</span>
        <strong>${item.value}</strong>
        <p>${item.caption}</p>
      </article>`
    )
    .join("")}</section>`;
}

function sourceSection() {
  return `<section class="content-band">
    <h2>계산 기준</h2>
    <p>${RULES_2026.assumptionLabel}입니다. 국민연금은 2026년 7월 1일부터 2027년 6월 30일까지의 기준소득월액 하한 41만 원, 상한 659만 원을 적용했습니다.</p>
    <ul class="plain-list">
      <li>국민연금: 근로자 부담 4.75%, 기준소득월액 상한·하한 적용</li>
      <li>건강보험: 근로자 부담 3.595%</li>
      <li>장기요양보험: 건강보험료의 13.14%</li>
      <li>고용보험: 근로자 부담 0.9%</li>
      <li>근로소득세: 근로소득공제, 기본공제, 4대보험 공제, 근로소득세액공제를 반영한 월 예상 원천징수액</li>
    </ul>
    <p class="note">정확한 월 원천징수는 국세청 근로소득 간이세액표, 부양가족 수, 자녀 수, 비과세 급여, 원천징수 선택 비율에 따라 달라질 수 있습니다.</p>
    <div class="source-links" aria-label="공식 참고 링크">
      <a href="https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7862&mi=6583" rel="noopener noreferrer">국세청 근로소득 간이세액표</a>
      <a href="https://www.nps.or.kr/" rel="noopener noreferrer">국민연금공단</a>
      <a href="https://www.mohw.go.kr/" rel="noopener noreferrer">보건복지부</a>
      <a href="https://www.work24.go.kr/" rel="noopener noreferrer">고용24</a>
    </div>
  </section>`;
}

function faqSection(items) {
  return `<section class="content-band">
    <h2>자주 묻는 질문</h2>
    <div class="faq">${items
      .map(
        (item) => `<details>
          <summary>${escapeHtml(item.q)}</summary>
          <p>${escapeHtml(item.a)}</p>
        </details>`
      )
      .join("")}</div>
  </section>`;
}

function relatedLinks(currentStart) {
  const links = [];
  if (currentStart && currentStart > 2000) {
    links.push({
      href: `/salary/2026/${currentStart - 1000}-${currentStart}`,
      label: salaryRangeLabel(currentStart - 1000, currentStart)
    });
  }
  if (currentStart && currentStart < 99000) {
    links.push({
      href: `/salary/2026/${currentStart + 1000}-${currentStart + 2000}`,
      label: salaryRangeLabel(currentStart + 1000, currentStart + 2000)
    });
  }
  links.push({ href: "/salary/2026", label: "2026년 전체 연봉표" });
  links.push({ href: "/calculator", label: "세전 세후 계산기" });

  return `<section class="content-band">
    <h2>관련 페이지</h2>
    <div class="link-grid">${links
      .map((link) => `<a href="${link.href}">${link.label}</a>`)
      .join("")}</div>
  </section>`;
}

function deductionMeaningSection() {
  return `<section class="content-band">
    <h2>공제 항목별 의미</h2>
    <div class="meaning-grid">${deductionMeta
      .map(
        ([, label, description]) => `<article>
          <strong>${label}</strong>
          <p>${description}</p>
        </article>`
      )
      .join("")}</div>
  </section>`;
}

function paycheckBreakdown(result) {
  const deductions = rowDeductions(result);
  return `<section class="content-band">
    <h2>월급에서 빠지는 항목</h2>
    <div class="paycheck">
      <div><span>월 세전급여</span><strong>${formatKRW(result.grossMonthly)}</strong></div>
      ${deductionMeta
        .map(
          ([key, label]) =>
            `<div><span>${label}</span><strong class="negative">${minusKRW(deductions[key])}</strong></div>`
        )
        .join("")}
      <div class="total"><span>총 공제액</span><strong class="negative">${minusKRW(result.totalDeductionMonthly)}</strong></div>
      <div class="net"><span>월 실수령액</span><strong>${formatKRW(result.netMonthly)}</strong></div>
    </div>
  </section>`;
}

function monthlyDecomposition(result) {
  const deductions = rowDeductions(result);
  const parts = [
    ["net", "실수령액", result.netMonthly],
    ...deductionMeta.map(([key, label]) => [key, label, deductions[key]])
  ];
  const bar = parts
    .map(([key, label, value]) => {
      const width = Math.max(0.5, (value / result.grossMonthly) * 100);
      return `<span class="segment segment-${key}" style="width:${width.toFixed(2)}%" title="${label} ${formatKRW(value)}"></span>`;
    })
    .join("");

  return `<section class="content-band">
    <h2>월급 분해 막대</h2>
    <p>세전 월급 ${formatKRW(result.grossMonthly)}이 실수령액과 공제 항목으로 어떻게 나뉘는지 보여줍니다.</p>
    <div class="stacked-bar" aria-label="월급 분해 막대">${bar}</div>
    <div class="legend">${parts
      .map(
        ([key, label, value]) =>
          `<span><i class="segment-${key}"></i>${label} ${formatKRW(value)}</span>`
      )
      .join("")}</div>
  </section>`;
}

function deductionShareChart(result) {
  const deductions = rowDeductions(result);
  return `<section class="content-band">
    <h2>총 공제액 중 비중</h2>
    <div class="bar-list">${deductionMeta
      .map(([key, label]) => {
        const value = deductions[key];
        const share = result.totalDeductionMonthly > 0 ? value / result.totalDeductionMonthly : 0;
        return `<div class="bar-row">
          <span>${label}</span>
          <div class="bar-track"><i style="width:${(share * 100).toFixed(2)}%"></i></div>
          <strong>${formatPercent(share)} · ${minusKRW(value)}</strong>
        </div>`;
      })
      .join("")}</div>
  </section>`;
}

function increaseChart(centerManwon) {
  const chartRows = rows.filter(
    (row) =>
      row.monthlyNetIncreaseFromPrevious != null &&
      row.manwon >= Math.max(2100, centerManwon - 500) &&
      row.manwon <= Math.min(100000, centerManwon + 500)
  );
  const maxIncrease = Math.max(...chartRows.map((row) => row.monthlyNetIncreaseFromPrevious), 1);
  return `<section class="content-band">
    <h2>연봉 100만 원 증가 시 월 실수령 증가</h2>
    <div class="increase-chart">${chartRows
      .map((row) => {
        const width = Math.max(2, (row.monthlyNetIncreaseFromPrevious / maxIncrease) * 100);
        return `<div class="bar-row">
          <span>${salaryLabelFromManwon(row.manwon)}</span>
          <div class="bar-track"><i style="width:${width.toFixed(2)}%"></i></div>
          <strong>${formatIncrease(row.monthlyNetIncreaseFromPrevious)}</strong>
        </div>`;
      })
      .join("")}</div>
  </section>`;
}

function homePage() {
  const row3000 = rows.find((row) => row.manwon === 3000);
  const row5000 = rows.find((row) => row.manwon === 5000);
  const row10000 = rows.find((row) => row.manwon === 10000);
  const body = `
    ${summaryCards([
      {
        label: "데이터 범위",
        value: "2,000만~10억 원",
        caption: "100만 원 단위로 981개 연봉 구간을 생성했습니다."
      },
      {
        label: "연봉 3,000만 원",
        value: formatKRW(row3000.netMonthly),
        caption: "기본 조건의 월 예상 실수령액입니다."
      },
      {
        label: "연봉 5,000만 원",
        value: formatKRW(row5000.netMonthly),
        caption: "4대보험과 예상 근로소득세를 함께 반영했습니다."
      },
      {
        label: "연봉 1억 원",
        value: formatKRW(row10000.netMonthly),
        caption: "국민연금 상한 적용 구간입니다."
      }
    ])}
    <section class="content-band">
      <h2>2026년 연봉 실수령액 전체표</h2>
      <p>세전 연봉 2,000만 원부터 10억 원까지 100만 원 단위로 월 세전 급여, 4대보험, 근로소득세, 지방소득세, 월 실수령액을 정리했습니다.</p>
      ${table(rows)}
    </section>
    ${deductionMeaningSection()}
    <section class="content-band">
      <h2>1,000만 원 구간별 표</h2>
      <div class="link-grid">${intervalStarts
        .map(
          (start) =>
            `<a href="/salary/2026/${start}-${start + 1000}">${salaryRangeLabel(start, start + 1000)}</a>`
        )
        .join("")}</div>
    </section>
    <section class="content-band">
      <h2>많이 찾는 연봉</h2>
      <div class="link-grid">${popularSalaries
        .map(
          (salary) =>
            `<a href="/salary/2026/${salary}">연봉 ${salaryLabelFromManwon(salary)} 실수령액</a>`
        )
        .join("")}</div>
    </section>
    ${sourceSection()}
    ${faqSection([
      {
        q: "표의 실수령액은 회사 급여명세서와 완전히 같은가요?",
        a: "아닙니다. 비과세 식대, 부양가족, 상여 지급 방식, 회사의 원천징수 선택 비율, 연말정산 결과에 따라 달라질 수 있습니다."
      },
      {
        q: "산재보험은 왜 공제 항목에 없나요?",
        a: "산재보험료는 일반적으로 사업주가 전액 부담하므로 근로자 월 실수령액 차감 항목에서 제외했습니다."
      },
      {
        q: "10억 원까지 표를 만든 이유는 무엇인가요?",
        a: "연봉 검색 수요가 넓게 분포하고, 고소득 구간에서는 국민연금 상한과 소득세율 변화가 실수령액에 크게 반영되기 때문입니다."
      }
    ])}
  `;

  return pageLayout({
    route: "/",
    title: "2026년 연봉 실수령액표｜세전 세후 월급·세금·4대보험 계산",
    description:
      "2026년 기준 세전 연봉 2,000만 원부터 10억 원까지 100만 원 단위 실수령액, 국민연금, 건강보험, 장기요양보험, 고용보험, 근로소득세를 확인하세요.",
    h1: "2026년 연봉 실수령액표",
    intro:
      "세전 연봉을 월급으로 나누고 4대보험, 근로소득세, 지방소득세를 반영해 월 실수령액을 표와 계산기로 확인합니다.",
    body,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: site.name,
      url: site.origin,
      potentialAction: {
        "@type": "SearchAction",
        target: `${site.origin}/salary/2026?query={search_term_string}`,
        "query-input": "required name=search_term_string"
      }
    }
  });
}

function salaryIndexPage() {
  const body = `
    <section class="content-band">
      <h2>전체 실수령액표</h2>
      <p>검색 브라우저에서 페이지 찾기를 사용하면 특정 연봉을 빠르게 찾을 수 있습니다. 예: 3,600만 원, 5,000만 원, 1억 원.</p>
      ${table(rows)}
    </section>
    ${deductionMeaningSection()}
    ${sourceSection()}
    ${relatedLinks()}
  `;

  return pageLayout({
    route: "/salary/2026",
    title: "2026년 연봉 실수령액 전체표｜2,000만 원부터 10억 원까지",
    description:
      "2026년 기준 연봉 실수령액 전체표입니다. 세전 연봉별 월급, 국민연금, 건강보험, 장기요양, 고용보험, 근로소득세, 지방소득세를 한 번에 확인하세요.",
    h1: "2026년 연봉 실수령액 전체표",
    intro: "2,000만 원부터 10억 원까지 100만 원 단위로 정리한 전체 데이터입니다.",
    body
  });
}

function intervalPage(start) {
  const end = start + 1000;
  const intervalRows = rows.filter((row) => row.manwon >= start && row.manwon <= end);
  const first = intervalRows[0];
  const last = intervalRows[intervalRows.length - 1];
  const midSalary = start + 500;
  const mid = rows.find((row) => row.manwon === midSalary) || first;
  const body = `
    ${summaryCards([
      {
        label: "월 실수령 시작",
        value: formatKRW(first.netMonthly),
        caption: `연봉 ${salaryLabelFromManwon(first.manwon)} 기준`
      },
      {
        label: "중간 연봉",
        value: formatKRW(mid.netMonthly),
        caption: `연봉 ${salaryLabelFromManwon(mid.manwon)} 기준`
      },
      {
        label: "월 실수령 끝",
        value: formatKRW(last.netMonthly),
        caption: `연봉 ${salaryLabelFromManwon(last.manwon)} 기준`
      }
    ])}
    <section class="content-band">
      <h2>연봉 ${salaryRangeLabel(start, end)} 실수령액표</h2>
      <p>이 구간은 100만 원 단위로 나누어 월 세전 급여, 4대보험, 예상 근로소득세, 지방소득세, 월 실수령액을 비교합니다.</p>
      ${table(intervalRows)}
    </section>
    ${deductionMeaningSection()}
    ${sourceSection()}
    ${faqSection([
      {
        q: `연봉 ${salaryLabelFromManwon(midSalary)}이면 월 실수령액은 얼마인가요?`,
        a: `${RULES_2026.assumptionLabel} 기준 월 예상 실수령액은 ${formatKRW(mid.netMonthly)}입니다.`
      },
      {
        q: "연봉이 100만 원 오르면 월 실수령액도 그대로 오르나요?",
        a: "아닙니다. 4대보험과 근로소득세가 함께 증가하므로 월 실수령 증가분은 세전 월 증가분보다 작습니다."
      },
      {
        q: "식대 비과세가 있으면 어떻게 달라지나요?",
        a: "비과세 금액은 4대보험과 과세 급여 계산에 영향을 줄 수 있습니다. 현재 표는 비교를 위해 비과세 0원을 기본값으로 고정했습니다."
      }
    ])}
    ${relatedLinks(start)}
  `;

  return pageLayout({
    route: `/salary/2026/${start}-${end}`,
    title: `2026년 연봉 ${salaryRangeLabel(start, end)} 실수령액표`,
    description: `2026년 기준 연봉 ${salaryLabelFromManwon(start)}부터 ${salaryLabelFromManwon(end)}까지 월 실수령액, 4대보험, 근로소득세, 지방소득세를 100만 원 단위로 확인하세요.`,
    h1: `2026년 연봉 ${salaryRangeLabel(start, end)} 실수령액`,
    intro: "구간별로 월급과 공제액이 어떻게 바뀌는지 빠르게 비교할 수 있습니다.",
    body,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: `연봉 ${salaryLabelFromManwon(midSalary)}이면 월 실수령액은 얼마인가요?`,
          acceptedAnswer: {
            "@type": "Answer",
            text: `${formatKRW(mid.netMonthly)}입니다.`
          }
        }
      ]
    }
  });
}

function detailPage(manwon) {
  const result = calculateSalary(manwon * 10_000);
  const row = rows.find((item) => item.manwon === manwon) || result;
  const route = `/salary/2026/${manwon}`;
  const body = `
    ${summaryCards([
      {
        label: "세전 월급",
        value: formatKRW(result.grossMonthly),
        caption: `세전 연봉 ${salaryLabelFromManwon(manwon)}을 12개월로 나눈 금액입니다.`
      },
      {
        label: "월 공제 합계",
        value: minusKRW(result.totalDeductionMonthly),
        caption: "4대보험과 예상 소득세, 지방소득세를 합산했습니다."
      },
      {
        label: "월 실수령액",
        value: formatKRW(result.netMonthly),
        caption: "기본 조건의 예상 월 지급액입니다."
      },
      {
        label: "연 실수령액",
        value: formatKRW(result.netAnnual),
        caption: "월 실수령액에 12개월을 곱한 값입니다."
      }
    ])}
    ${paycheckBreakdown(result)}
    ${monthlyDecomposition(result)}
    ${deductionShareChart(result)}
    ${increaseChart(manwon)}
    <section class="content-band">
      <h2>연봉 ${salaryLabelFromManwon(manwon)} 공제 상세</h2>
      <dl class="breakdown">
        ${deductionMeta
          .map(
            ([key, label]) =>
              `<div><dt>${label}</dt><dd class="negative">${minusKRW(rowDeductions(result)[key])}</dd></div>`
          )
          .join("")}
        <div><dt>총 공제액</dt><dd class="negative">${minusKRW(result.totalDeductionMonthly)}</dd></div>
        <div><dt>실수령률</dt><dd>${formatPercent(result.netRate)}</dd></div>
        <div><dt>이전 구간 대비</dt><dd>${formatIncrease(row.monthlyNetIncreaseFromPrevious)}</dd></div>
      </dl>
    </section>
    <section class="content-band">
      <h2>주변 연봉 비교</h2>
      ${table(
        rows.filter((row) => row.manwon >= Math.max(2000, manwon - 300) && row.manwon <= Math.min(100000, manwon + 300)),
        { compact: true }
      )}
    </section>
    ${sourceSection()}
    ${faqSection([
      {
        q: `연봉 ${salaryLabelFromManwon(manwon)}의 월 실수령액은 얼마인가요?`,
        a: `${RULES_2026.assumptionLabel} 기준 월 예상 실수령액은 ${formatKRW(result.netMonthly)}입니다.`
      },
      {
        q: "월급명세서와 차이가 나는 흔한 이유는 무엇인가요?",
        a: "비과세 식대, 부양가족 수, 상여 지급 방식, 원천징수 선택 비율, 회사별 복리후생 공제가 다르기 때문입니다."
      }
    ])}
    ${relatedLinks(Math.floor(manwon / 1000) * 1000)}
  `;

  return pageLayout({
    route,
    title: `2026년 연봉 ${salaryLabelFromManwon(manwon)} 실수령액｜월급·세금·4대보험 공제표`,
    description: `2026년 기준 연봉 ${salaryLabelFromManwon(manwon)}의 월 실수령액, 국민연금, 건강보험, 장기요양보험, 고용보험, 근로소득세, 지방소득세를 확인하세요.`,
    h1: `2026년 연봉 ${salaryLabelFromManwon(manwon)} 실수령액`,
    intro: "세전 월급에서 4대보험과 예상 세금을 차감한 월 실수령액을 항목별로 정리했습니다.",
    body,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: `연봉 ${salaryLabelFromManwon(manwon)}의 월 실수령액은 얼마인가요?`,
          acceptedAnswer: {
            "@type": "Answer",
            text: `${formatKRW(result.netMonthly)}입니다.`
          }
        }
      ]
    }
  });
}

function calculatorPage() {
  const body = `
    <section class="content-band calculator-panel">
      <h2>세전 세후 계산기</h2>
      <div class="form-grid">
        <label>세전 연봉
          <input id="annualSalaryInput" type="number" min="0" step="100" value="5000" inputmode="numeric">
          <span>만 원</span>
        </label>
        <label>월 비과세
          <input id="nonTaxableInput" type="number" min="0" step="1" value="0" inputmode="numeric">
          <span>만 원</span>
        </label>
        <label>원천징수
          <select id="withholdingInput">
            <option value="0.8">80%</option>
            <option value="1" selected>100%</option>
            <option value="1.2">120%</option>
          </select>
        </label>
      </div>
      <div id="calculatorOutput" class="result-panel"></div>
    </section>
    ${sourceSection()}
    ${faqSection([
      {
        q: "원천징수 80%, 100%, 120%는 무엇인가요?",
        a: "근로자가 매월 급여에서 미리 납부할 소득세 비율을 선택하는 제도입니다. 최종 세액은 연말정산에서 다시 정산됩니다."
      },
      {
        q: "퇴직금은 포함되어 있나요?",
        a: "아닙니다. 이 계산기는 일반 월 급여의 실수령액을 보기 위한 도구이며 퇴직금은 별도로 봐야 합니다."
      }
    ])}
  `;

  return pageLayout({
    route: "/calculator",
    title: "세전 세후 계산기｜2026년 연봉·월급 실수령액 계산",
    description:
      "세전 연봉, 월 비과세 금액, 원천징수 비율을 입력해 2026년 기준 월 실수령액과 4대보험, 근로소득세, 지방소득세를 계산하세요.",
    h1: "세전 세후 계산기",
    intro: "연봉과 비과세 금액을 직접 입력해 월 실수령액을 계산합니다.",
    body
  });
}

function guidePage() {
  const body = `
    ${sourceSection()}
    <section class="content-band">
      <h2>왜 실제 급여와 다를 수 있나요?</h2>
      <p>실수령액은 회사 급여 정책과 개인 세무 정보의 영향을 받습니다. 같은 연봉이라도 식대 비과세, 차량보조금, 부양가족 수, 상여 지급 방식, 원천징수 비율, 사내 공제 항목에 따라 월 지급액이 달라집니다.</p>
      <p>이 사이트는 검색과 비교에 적합하도록 기준을 고정한 표준 추정치를 제공합니다. 국세청 간이세액표 원문 파일을 반영하면 근로소득세 산출부를 더 정밀하게 교체할 수 있도록 계산 로직을 분리했습니다.</p>
    </section>
    <section class="content-band">
      <h2>검색 노출과 광고 준비</h2>
      <p>정적 HTML, canonical URL, sitemap.xml, robots.txt, FAQ 구조화 데이터를 생성합니다. AdSense 승인을 받은 뒤 발급된 게시자 ID를 빌드 설정의 <code>adsenseClient</code>와 <code>ads.txt</code>에 넣으면 광고 영역을 활성화할 수 있습니다.</p>
      <div class="source-links" aria-label="검색 및 광고 공식 문서">
        <a href="https://developers.google.com/search/docs/fundamentals/seo-starter-guide" rel="noopener noreferrer">Google SEO 기본 가이드</a>
        <a href="https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls" rel="noopener noreferrer">canonical URL 안내</a>
        <a href="https://support.google.com/adsense/answer/9724" rel="noopener noreferrer">AdSense 자격 요건</a>
      </div>
    </section>
    ${relatedLinks()}
  `;

  return pageLayout({
    route: "/guide/2026",
    title: "2026년 연봉 실수령액 계산 기준｜세금·4대보험·검색 등록 안내",
    description:
      "2026년 연봉 실수령액표의 계산 기준, 4대보험 요율, 근로소득세 추정 방식, Google 검색 등록과 AdSense 준비 항목을 정리했습니다.",
    h1: "2026년 계산 기준",
    intro: "표와 계산기가 어떤 전제에서 만들어졌는지 투명하게 정리했습니다.",
    body
  });
}

function clientCalculatorJs() {
  return `const RULES = ${JSON.stringify(RULES_2026)};
function roundDown10(value){return Math.floor(value/10)*10}
function formatKRW(value){return Math.round(value).toLocaleString("ko-KR")+"원"}
function minusKRW(value){return value>0?"-"+formatKRW(value):"0원"}
function formatPercent(value){return (value*100).toFixed(1)+"%"}
function earnedIncomeDeduction(grossAnnual){let deduction;if(grossAnnual<=5000000){deduction=grossAnnual*.7}else if(grossAnnual<=15000000){deduction=3500000+(grossAnnual-5000000)*.4}else if(grossAnnual<=45000000){deduction=7500000+(grossAnnual-15000000)*.15}else if(grossAnnual<=100000000){deduction=12000000+(grossAnnual-45000000)*.05}else{deduction=14750000+(grossAnnual-100000000)*.02}return Math.min(deduction,20000000)}
function progressiveIncomeTax(taxBase){if(taxBase<=14000000)return taxBase*.06;if(taxBase<=50000000)return taxBase*.15-1260000;if(taxBase<=88000000)return taxBase*.24-5760000;if(taxBase<=150000000)return taxBase*.35-15460000;if(taxBase<=300000000)return taxBase*.38-19960000;if(taxBase<=500000000)return taxBase*.4-25960000;if(taxBase<=1000000000)return taxBase*.42-35960000;return taxBase*.45-65960000}
function employmentTaxCredit(calculatedTax,grossAnnual){const rawCredit=calculatedTax<=1300000?calculatedTax*.55:715000+(calculatedTax-1300000)*.3;let limit;if(grossAnnual<=33000000){limit=740000}else if(grossAnnual<=70000000){limit=Math.max(660000,740000-(grossAnnual-33000000)*.008)}else{const floor=grossAnnual<=120000000?500000:200000;limit=Math.max(floor,660000-(grossAnnual-70000000)*.5)}return Math.min(rawCredit,limit)}
function calculateSalary(grossAnnual,options={}){const nonTaxableMonthly=options.nonTaxableMonthly||0;const withholdingRate=options.withholdingRate||1;const grossMonthly=grossAnnual/12;const taxableMonthly=Math.max(0,grossMonthly-nonTaxableMonthly);const pensionBase=Math.min(RULES.nationalPension.baseMaxMonthly,Math.max(RULES.nationalPension.baseMinMonthly,Math.floor(taxableMonthly/1000)*1000));const nationalPension=roundDown10(pensionBase*RULES.nationalPension.employeeRate);const healthInsurance=roundDown10(taxableMonthly*RULES.healthInsurance.employeeRate);const longTermCare=roundDown10(healthInsurance*RULES.longTermCare.rateOnHealthInsurance);const employmentInsurance=roundDown10(taxableMonthly*RULES.employmentInsurance.employeeRate);const annualTaxablePay=Math.max(0,grossAnnual-nonTaxableMonthly*12);const employmentIncome=Math.max(0,annualTaxablePay-earnedIncomeDeduction(annualTaxablePay));const annualSocialInsurance=(nationalPension+healthInsurance+longTermCare+employmentInsurance)*12;const taxBase=Math.max(0,employmentIncome-RULES.personalDeduction-annualSocialInsurance);const calculatedTax=Math.max(0,progressiveIncomeTax(taxBase));const taxCredit=employmentTaxCredit(calculatedTax,annualTaxablePay);const annualIncomeTax=Math.max(0,calculatedTax-taxCredit);const incomeTax=roundDown10(annualIncomeTax/12*withholdingRate);const localIncomeTax=roundDown10(incomeTax*.1);const deductions={nationalPension,healthInsurance,longTermCare,employmentInsurance,incomeTax,localIncomeTax};const totalDeductionMonthly=nationalPension+healthInsurance+longTermCare+employmentInsurance+incomeTax+localIncomeTax;const netMonthly=Math.round(grossMonthly-totalDeductionMonthly);return{grossMonthly:Math.round(grossMonthly),deductions,nationalPension,healthInsurance,longTermCare,employmentInsurance,incomeTax,localIncomeTax,totalDeductionMonthly,netMonthly,netAnnual:netMonthly*12,netRate:grossMonthly>0?netMonthly/grossMonthly:0}}
function renderQuick(){const input=document.querySelector("#quickSalary");const output=document.querySelector("#quickResult");if(!input||!output)return;const update=()=>{const manwon=Number(input.value||0);const r=calculateSalary(manwon*10000);output.textContent="월 실수령액 "+formatKRW(r.netMonthly)};input.addEventListener("input",update);update()}
function renderCalculator(){const salary=document.querySelector("#annualSalaryInput");const nonTax=document.querySelector("#nonTaxableInput");const withholding=document.querySelector("#withholdingInput");const output=document.querySelector("#calculatorOutput");if(!salary||!nonTax||!withholding||!output)return;const update=()=>{const r=calculateSalary(Number(salary.value||0)*10000,{nonTaxableMonthly:Number(nonTax.value||0)*10000,withholdingRate:Number(withholding.value||1)});output.innerHTML=\`<div><span>월 실수령액</span><strong>\${formatKRW(r.netMonthly)}</strong></div><div><span>월 공제 합계</span><strong class="negative">\${minusKRW(r.totalDeductionMonthly)}</strong></div><div><span>실수령률</span><strong>\${formatPercent(r.netRate)}</strong></div><div><span>연 실수령액</span><strong>\${formatKRW(r.netAnnual)}</strong></div><table><tbody><tr><th>월 세전급여</th><td>\${formatKRW(r.grossMonthly)}</td></tr><tr><th>국민연금</th><td class="negative">\${minusKRW(r.nationalPension)}</td></tr><tr><th>건강보험</th><td class="negative">\${minusKRW(r.healthInsurance)}</td></tr><tr><th>장기요양</th><td class="negative">\${minusKRW(r.longTermCare)}</td></tr><tr><th>고용보험</th><td class="negative">\${minusKRW(r.employmentInsurance)}</td></tr><tr><th>근로소득세</th><td class="negative">\${minusKRW(r.incomeTax)}</td></tr><tr><th>지방소득세</th><td class="negative">\${minusKRW(r.localIncomeTax)}</td></tr></tbody></table>\`};[salary,nonTax,withholding].forEach((el)=>el.addEventListener("input",update));withholding.addEventListener("change",update);update()}
renderQuick();renderCalculator();`;
}

function stylesCss() {
  return `:root{color-scheme:light;--ink:#17201b;--muted:#5d6862;--line:#d9dfda;--paper:#fbfcfa;--band:#eef3f0;--accent:#0f6b54;--accent-2:#315c9b;--danger:#a33a32;--warn:#8f4a12;--white:#fff}*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:var(--paper);color:var(--ink);line-height:1.6}a{color:inherit}.site-header{position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;gap:24px;padding:14px clamp(16px,4vw,48px);border-bottom:1px solid var(--line);background:rgba(251,252,250,.95);backdrop-filter:blur(10px)}.brand{font-weight:800;text-decoration:none;font-size:18px}.site-header nav{display:flex;gap:8px;flex-wrap:wrap}.site-header nav a{padding:8px 10px;text-decoration:none;border-radius:6px;color:var(--muted)}.site-header nav a:hover{background:var(--band);color:var(--ink)}main{max-width:1440px;margin:0 auto;padding:0 clamp(12px,2vw,28px) 56px}.hero{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:32px;align-items:end;padding:48px 0 30px;border-bottom:1px solid var(--line)}.eyebrow{margin:0 0 8px;color:var(--accent);font-weight:800}.hero h1{margin:0;font-size:clamp(34px,5vw,64px);line-height:1.08;letter-spacing:0}.intro{max-width:760px;margin:16px 0 0;color:var(--muted);font-size:18px}.quick-calc{border:1px solid var(--line);background:var(--white);border-radius:8px;padding:18px}.quick-calc label,.form-grid label{display:grid;gap:8px;font-weight:700}.input-row{display:grid;grid-template-columns:1fr auto;align-items:center;gap:8px}.quick-calc input,.form-grid input,.form-grid select{width:100%;height:44px;border:1px solid var(--line);border-radius:6px;padding:0 12px;font:inherit;background:#fff}.quick-calc output{display:block;margin-top:14px;padding-top:14px;border-top:1px solid var(--line);font-weight:800;color:var(--accent)}.ad-slot{display:grid;place-items:center;min-height:92px;margin:24px 0;border:1px dashed #b9c1bb;border-radius:8px;background:#f7f9f7;color:var(--muted);font-size:14px}.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:28px 0}.metrics article{background:var(--white);border:1px solid var(--line);border-radius:8px;padding:18px}.metrics span{display:block;color:var(--muted);font-size:14px}.metrics strong{display:block;margin-top:6px;font-size:24px;line-height:1.2;color:var(--accent)}.metrics p{margin:8px 0 0;color:var(--muted);font-size:14px}.content-band{padding:32px 0;border-top:1px solid var(--line)}.content-band h2{margin:0 0 12px;font-size:26px;letter-spacing:0}.content-band p{max-width:860px;color:var(--muted)}.note{padding:12px 14px;border-left:4px solid var(--warn);background:#fff8ef}.plain-list{padding-left:20px;color:var(--muted)}.plain-list li+li{margin-top:4px}.source-links{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}.source-links a{padding:8px 10px;border:1px solid var(--line);border-radius:6px;background:var(--white);text-decoration:none;color:var(--accent-2);font-weight:700}.table-wrap{width:max-content;max-width:100%;overflow:visible;border:1px solid var(--line);border-radius:8px;background:var(--white)}table{width:800px;max-width:none;border-collapse:collapse;table-layout:auto}th,td{padding:9px 0;border-bottom:1px solid var(--line);text-align:center;white-space:nowrap;font-family:"Arial Narrow","Roboto Condensed",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:14px;line-height:1.22;letter-spacing:0;font-kerning:none;font-stretch:condensed;font-variant-numeric:tabular-nums}th:first-child,td:first-child{text-align:center;position:sticky;left:0;background:var(--white);z-index:1}thead th{position:sticky;top:0;background:#edf4ef;color:#24352c;font-weight:800;z-index:2}thead th:first-child{z-index:3}tbody tr:hover{background:#f6faf7}tbody tr:hover th:first-child{background:#f6faf7}.group-row td,.table-ad-row td{position:static!important;text-align:left;white-space:normal;z-index:auto}.group-row td{background:#dfeae4!important;color:#18382e;font-weight:900;font-size:12px;border-top:2px solid #b9ccc1;border-bottom:1px solid #b9ccc1}.table-ad-row td{background:#fbfcfa!important;padding:14px 12px}.table-ad-slot{display:grid;place-items:center;min-height:86px;border:1px dashed #b9c1bb;border-radius:8px;background:#f7f9f7;color:var(--muted);font-size:14px}.repeat-header th{background:#edf4ef;color:#24352c;font-weight:800}.repeat-header th:first-child{background:#edf4ef}.negative{color:var(--danger)}.increase{color:var(--accent-2);font-weight:800}.paycheck div{display:flex;justify-content:space-between;gap:14px;padding:10px 12px;border:1px solid var(--line);border-radius:6px;background:#fff}.paycheck span{color:var(--muted)}.meaning-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.meaning-grid article{border:1px solid var(--line);border-radius:8px;background:var(--white);padding:16px}.meaning-grid p{margin:6px 0 0}.paycheck{max-width:620px;display:grid;gap:8px}.paycheck .total{border-color:#dcb9b5;background:#fff7f6}.paycheck .net{border-color:#aed3c7;background:#f2fbf7}.stacked-bar{display:flex;overflow:hidden;height:36px;border-radius:8px;border:1px solid var(--line);background:#fff}.segment{display:block;min-width:2px}.segment-net{background:#0f6b54}.segment-nationalPension{background:#315c9b}.segment-healthInsurance{background:#5a8f47}.segment-longTermCare{background:#9d7b2f}.segment-employmentInsurance{background:#477f8f}.segment-incomeTax{background:#a33a32}.segment-localIncomeTax{background:#7b4a87}.legend{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}.legend span{display:inline-flex;align-items:center;gap:6px;color:var(--muted);font-size:14px}.legend i{width:12px;height:12px;border-radius:3px;display:inline-block}.bar-list,.increase-chart{display:grid;gap:10px;max-width:820px}.bar-row{display:grid;grid-template-columns:120px minmax(120px,1fr) 180px;gap:12px;align-items:center}.bar-row span{font-weight:700}.bar-row strong{text-align:right;color:var(--muted)}.bar-track{height:12px;border-radius:999px;background:#e7ece8;overflow:hidden}.bar-track i{display:block;height:100%;border-radius:999px;background:var(--accent-2)}.link-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;margin-top:16px}.link-grid a{display:flex;align-items:center;min-height:44px;padding:10px 12px;border:1px solid var(--line);border-radius:6px;background:var(--white);text-decoration:none;font-weight:700;color:var(--accent-2)}.link-grid a:hover{border-color:var(--accent-2);background:#f3f7fd}.faq{display:grid;gap:10px}.faq details{border:1px solid var(--line);border-radius:8px;background:var(--white);padding:14px}.faq summary{cursor:pointer;font-weight:800}.faq p{margin:10px 0 0}.breakdown{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.breakdown div{display:flex;justify-content:space-between;gap:16px;border:1px solid var(--line);border-radius:8px;background:var(--white);padding:14px}.breakdown dt{font-weight:800}.breakdown dd{margin:0;color:var(--accent)}.breakdown dd.negative{color:var(--danger)}.calculator-panel{background:var(--band);margin-top:28px;padding:24px;border-radius:8px;border:1px solid var(--line)}.form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.result-panel{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:18px}.result-panel>div{border:1px solid var(--line);border-radius:8px;background:var(--white);padding:16px}.result-panel span{display:block;color:var(--muted);font-size:14px}.result-panel strong{display:block;margin-top:4px;font-size:24px;color:var(--accent)}.result-panel strong.negative{color:var(--danger)}.result-panel table{grid-column:1/-1;min-width:0;background:var(--white);border:1px solid var(--line);border-radius:8px;overflow:hidden}code{padding:2px 5px;border-radius:4px;background:#e7ece8}footer{border-top:1px solid var(--line);padding:24px clamp(16px,4vw,48px);color:var(--muted);font-size:14px;max-width:1240px;margin:0 auto}@media (max-width:1080px){th,td{padding:8px 0;font-size:14px}}@media (max-width:860px){.site-header{align-items:flex-start;flex-direction:column}.hero{grid-template-columns:1fr;padding-top:30px}.metrics{grid-template-columns:1fr 1fr}.form-grid,.result-panel{grid-template-columns:1fr}.hero h1{font-size:36px}.bar-row{grid-template-columns:1fr;gap:5px}.bar-row strong{text-align:left}}@media (max-width:760px){main{padding-left:10px;padding-right:10px}.table-wrap{width:100%;max-width:100%;overflow-x:auto;overflow-y:visible;-webkit-overflow-scrolling:touch;border:1px solid var(--line);background:var(--white)}.table-wrap table{width:800px;min-width:800px}.table-ad-row td{padding:12px 8px}.table-ad-slot{min-height:74px}.content-band h2{font-size:22px}}@media (max-width:520px){.metrics{grid-template-columns:1fr}.site-header nav a{padding-left:0}.quick-calc{padding:14px}.stacked-bar{height:30px}}`;
}

async function main() {
  await rm(dist, { recursive: true, force: true });
  await mkdir(path.join(dist, "assets"), { recursive: true });
  await writeFile(path.join(dist, "assets", "styles.css"), stylesCss());
  await writeFile(path.join(dist, "assets", "calculator.js"), clientCalculatorJs());

  await writePage("/", homePage());
  await writePage("/salary/2026", salaryIndexPage());
  await writePage("/calculator", calculatorPage());
  await writePage("/guide/2026", guidePage());

  for (const start of intervalStarts) {
    await writePage(`/salary/2026/${start}-${start + 1000}`, intervalPage(start));
  }
  for (const salary of popularSalaries) {
    await writePage(`/salary/2026/${salary}`, detailPage(salary));
  }

  const routes = [
    "/",
    "/salary/2026",
    "/calculator",
    "/guide/2026",
    ...intervalStarts.map((start) => `/salary/2026/${start}-${start + 1000}`),
    ...popularSalaries.map((salary) => `/salary/2026/${salary}`)
  ];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map(
    (route) => `  <url>
    <loc>${canonical(route)}</loc>
    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>
  </url>`
  )
  .join("\n")}
</urlset>
`;
  await writeFile(path.join(dist, "sitemap.xml"), sitemap);
  await writeFile(
    path.join(dist, "robots.txt"),
    `User-agent: *
Allow: /

Sitemap: ${site.origin}/sitemap.xml
`
  );
  await writeFile(
    path.join(dist, "ads.txt"),
    "# Replace this file after AdSense approval, for example:\n# google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0\n"
  );

  console.log(`Built ${routes.length} pages in ${path.relative(root, dist)}`);
}

main();
