export const RULES_2026 = {
  year: 2026,
  effectiveFrom: "2026-07-01",
  assumptionLabel: "2026년 하반기, 본인 1명, 비과세 0원, 원천징수 100%",
  nationalPension: {
    employeeRate: 0.0475,
    baseMinMonthly: 410_000,
    baseMaxMonthly: 6_590_000
  },
  healthInsurance: {
    employeeRate: 0.03595
  },
  longTermCare: {
    rateOnHealthInsurance: 0.1314
  },
  employmentInsurance: {
    employeeRate: 0.009
  },
  personalDeduction: 1_500_000
};

export function roundDown10(value) {
  return Math.floor(value / 10) * 10;
}

export function formatKRW(value) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

export function formatManwon(value) {
  return `${Math.round(value / 10_000).toLocaleString("ko-KR")}만 원`;
}

export function salaryLabelFromManwon(manwon) {
  if (manwon >= 10_000) {
    const eok = Math.floor(manwon / 10_000);
    const restManwon = manwon % 10_000;
    if (restManwon === 0) return `${eok.toLocaleString("ko-KR")}억 원`;
    return `${eok.toLocaleString("ko-KR")}억 ${restManwon.toLocaleString("ko-KR")}만 원`;
  }
  return `${manwon.toLocaleString("ko-KR")}만 원`;
}

export function earnedIncomeDeduction(grossAnnual) {
  let deduction;

  if (grossAnnual <= 5_000_000) {
    deduction = grossAnnual * 0.7;
  } else if (grossAnnual <= 15_000_000) {
    deduction = 3_500_000 + (grossAnnual - 5_000_000) * 0.4;
  } else if (grossAnnual <= 45_000_000) {
    deduction = 7_500_000 + (grossAnnual - 15_000_000) * 0.15;
  } else if (grossAnnual <= 100_000_000) {
    deduction = 12_000_000 + (grossAnnual - 45_000_000) * 0.05;
  } else {
    deduction = 14_750_000 + (grossAnnual - 100_000_000) * 0.02;
  }

  return Math.min(deduction, 20_000_000);
}

export function progressiveIncomeTax(taxBase) {
  if (taxBase <= 14_000_000) return taxBase * 0.06;
  if (taxBase <= 50_000_000) return taxBase * 0.15 - 1_260_000;
  if (taxBase <= 88_000_000) return taxBase * 0.24 - 5_760_000;
  if (taxBase <= 150_000_000) return taxBase * 0.35 - 15_460_000;
  if (taxBase <= 300_000_000) return taxBase * 0.38 - 19_960_000;
  if (taxBase <= 500_000_000) return taxBase * 0.4 - 25_960_000;
  if (taxBase <= 1_000_000_000) return taxBase * 0.42 - 35_960_000;
  return taxBase * 0.45 - 65_960_000;
}

export function employmentTaxCredit(calculatedTax, grossAnnual) {
  const rawCredit =
    calculatedTax <= 1_300_000
      ? calculatedTax * 0.55
      : 715_000 + (calculatedTax - 1_300_000) * 0.3;

  let limit;
  if (grossAnnual <= 33_000_000) {
    limit = 740_000;
  } else if (grossAnnual <= 70_000_000) {
    limit = Math.max(660_000, 740_000 - (grossAnnual - 33_000_000) * 0.008);
  } else {
    const floor = grossAnnual <= 120_000_000 ? 500_000 : 200_000;
    limit = Math.max(floor, 660_000 - (grossAnnual - 70_000_000) * 0.5);
  }

  return Math.min(rawCredit, limit);
}

export function calculateSalary(grossAnnual, options = {}) {
  const rules = options.rules || RULES_2026;
  const nonTaxableMonthly = options.nonTaxableMonthly || 0;
  const withholdingRate = options.withholdingRate || 1;
  const grossMonthly = grossAnnual / 12;
  const taxableMonthly = Math.max(0, grossMonthly - nonTaxableMonthly);

  const pensionBase = Math.min(
    rules.nationalPension.baseMaxMonthly,
    Math.max(rules.nationalPension.baseMinMonthly, Math.floor(taxableMonthly / 1000) * 1000)
  );
  const nationalPension = roundDown10(pensionBase * rules.nationalPension.employeeRate);
  const healthInsurance = roundDown10(taxableMonthly * rules.healthInsurance.employeeRate);
  const longTermCare = roundDown10(healthInsurance * rules.longTermCare.rateOnHealthInsurance);
  const employmentInsurance = roundDown10(taxableMonthly * rules.employmentInsurance.employeeRate);

  const annualTaxablePay = Math.max(0, grossAnnual - nonTaxableMonthly * 12);
  const employmentIncome = Math.max(0, annualTaxablePay - earnedIncomeDeduction(annualTaxablePay));
  const annualSocialInsurance =
    (nationalPension + healthInsurance + longTermCare + employmentInsurance) * 12;
  const taxBase = Math.max(
    0,
    employmentIncome - rules.personalDeduction - annualSocialInsurance
  );
  const calculatedTax = Math.max(0, progressiveIncomeTax(taxBase));
  const taxCredit = employmentTaxCredit(calculatedTax, annualTaxablePay);
  const annualIncomeTax = Math.max(0, calculatedTax - taxCredit);
  const incomeTax = roundDown10((annualIncomeTax / 12) * withholdingRate);
  const localIncomeTax = roundDown10(incomeTax * 0.1);
  const deductions = {
    nationalPension,
    healthInsurance,
    longTermCare,
    employmentInsurance,
    incomeTax,
    localIncomeTax
  };
  const totalDeductionMonthly =
    deductions.nationalPension +
    deductions.healthInsurance +
    deductions.longTermCare +
    deductions.employmentInsurance +
    deductions.incomeTax +
    deductions.localIncomeTax;
  const netMonthly = Math.round(grossMonthly - totalDeductionMonthly);
  const netAnnual = netMonthly * 12;
  const netRate = grossMonthly > 0 ? netMonthly / grossMonthly : 0;

  return {
    year: rules.year,
    grossAnnual,
    grossMonthly: Math.round(grossMonthly),
    taxableMonthly: Math.round(taxableMonthly),
    deductions,
    nationalPension,
    healthInsurance,
    longTermCare,
    employmentInsurance,
    incomeTax,
    localIncomeTax,
    totalDeductionMonthly,
    netMonthly,
    netAnnual,
    netRate,
    monthlyNetIncreaseFromPrevious: null,
    annualSocialInsurance,
    earnedIncomeDeduction: Math.round(earnedIncomeDeduction(annualTaxablePay)),
    taxBase: Math.round(taxBase),
    calculatedTax: Math.round(calculatedTax),
    taxCredit: Math.round(taxCredit)
  };
}

export function makeSalaryRows({ startManwon = 2000, endManwon = 100000, stepManwon = 100 } = {}) {
  const rows = [];
  let previousNetMonthly = null;
  for (let manwon = startManwon; manwon <= endManwon; manwon += stepManwon) {
    const result = calculateSalary(manwon * 10_000);
    rows.push({
      manwon,
      ...result,
      monthlyNetIncreaseFromPrevious:
        previousNetMonthly == null ? null : result.netMonthly - previousNetMonthly
    });
    previousNetMonthly = result.netMonthly;
  }
  return rows;
}
