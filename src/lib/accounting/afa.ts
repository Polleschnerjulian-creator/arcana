// ─── AfA (Absetzung fuer Abnutzung) — Depreciation Calculation ──
//
// Berechnet lineare und degressive Abschreibungen nach deutschem
// Steuerrecht. Erste und letzte Jahre werden zeitanteilig (pro-rata)
// basierend auf dem Anschaffungsmonat berechnet.

// ─── Types ───────────────────────────────────────────────────────

export interface DepreciationYear {
  year: number;
  openingValue: number;
  depreciation: number;
  closingValue: number;
}

export interface LinearDepreciationResult {
  annualAmount: number;
  monthlyAmount: number;
}

// ─── Linear Depreciation ────────────────────────────────────────

/**
 * Berechnet die jaehrliche und monatliche lineare Abschreibung.
 *
 * Formel: (Anschaffungskosten - Restwert) / Nutzungsdauer
 */
export function calculateLinearDepreciation(
  purchasePrice: number,
  residualValue: number,
  usefulLifeYears: number
): LinearDepreciationResult {
  if (usefulLifeYears <= 0) {
    return { annualAmount: 0, monthlyAmount: 0 };
  }

  const annualAmount = roundCurrency(
    (purchasePrice - residualValue) / usefulLifeYears
  );
  const monthlyAmount = roundCurrency(annualAmount / 12);

  return { annualAmount, monthlyAmount };
}

// ─── Depreciation Schedule ──────────────────────────────────────

/**
 * Erstellt einen vollstaendigen Abschreibungsplan.
 *
 * - Erstes Jahr: zeitanteilig ab Anschaffungsmonat
 * - Zwischenjahre: voller Jahresbetrag
 * - Letztes Jahr: Restbetrag bis zum Restwert
 *
 * Bei degressiver AfA: 2x linearer Satz (max. 20%), mit Wechsel
 * zur linearen AfA wenn diese guenstiger wird.
 */
export function calculateDepreciationSchedule(asset: {
  purchasePrice: number;
  purchaseDate: Date;
  usefulLifeYears: number;
  residualValue: number;
  depreciationMethod: string;
}): DepreciationYear[] {
  const {
    purchasePrice,
    purchaseDate,
    usefulLifeYears,
    residualValue,
    depreciationMethod,
  } = asset;

  if (usefulLifeYears <= 0 || purchasePrice <= residualValue) {
    return [];
  }

  if (depreciationMethod === "DEGRESSIVE") {
    return calculateDegressiveSchedule(
      purchasePrice,
      purchaseDate,
      usefulLifeYears,
      residualValue
    );
  }

  return calculateLinearSchedule(
    purchasePrice,
    purchaseDate,
    usefulLifeYears,
    residualValue
  );
}

// ─── Linear Schedule ────────────────────────────────────────────

function calculateLinearSchedule(
  purchasePrice: number,
  purchaseDate: Date,
  usefulLifeYears: number,
  residualValue: number
): DepreciationYear[] {
  const schedule: DepreciationYear[] = [];
  const purchaseYear = purchaseDate.getFullYear();
  // Month is 0-indexed in JS, so +1 for human month
  const purchaseMonth = purchaseDate.getMonth() + 1;

  // Months remaining in the purchase year (including purchase month)
  const monthsInFirstYear = 12 - purchaseMonth + 1;

  const { annualAmount } = calculateLinearDepreciation(
    purchasePrice,
    residualValue,
    usefulLifeYears
  );

  let currentValue = purchasePrice;
  const depreciableAmount = purchasePrice - residualValue;

  // First year: pro-rata
  const firstYearDepreciation = roundCurrency(
    (annualAmount * monthsInFirstYear) / 12
  );
  const firstYearActual = Math.min(
    firstYearDepreciation,
    currentValue - residualValue
  );

  if (firstYearActual > 0) {
    schedule.push({
      year: purchaseYear,
      openingValue: roundCurrency(currentValue),
      depreciation: roundCurrency(firstYearActual),
      closingValue: roundCurrency(currentValue - firstYearActual),
    });
    currentValue = roundCurrency(currentValue - firstYearActual);
  }

  // Remaining depreciation after first year
  let totalDepreciated = firstYearActual;

  // Full years
  let year = purchaseYear + 1;
  while (totalDepreciated < depreciableAmount && currentValue > residualValue) {
    const remaining = roundCurrency(currentValue - residualValue);
    const yearDepreciation = Math.min(annualAmount, remaining);

    if (yearDepreciation <= 0) break;

    schedule.push({
      year,
      openingValue: roundCurrency(currentValue),
      depreciation: roundCurrency(yearDepreciation),
      closingValue: roundCurrency(currentValue - yearDepreciation),
    });

    currentValue = roundCurrency(currentValue - yearDepreciation);
    totalDepreciated = roundCurrency(totalDepreciated + yearDepreciation);
    year++;
  }

  return schedule;
}

// ─── Degressive Schedule ────────────────────────────────────────

/**
 * Degressive AfA: doppelter linearer Satz, max. 20%.
 * Wechsel zur linearen AfA, wenn linear guenstiger wird.
 */
function calculateDegressiveSchedule(
  purchasePrice: number,
  purchaseDate: Date,
  usefulLifeYears: number,
  residualValue: number
): DepreciationYear[] {
  const schedule: DepreciationYear[] = [];
  const purchaseYear = purchaseDate.getFullYear();
  const purchaseMonth = purchaseDate.getMonth() + 1;
  const monthsInFirstYear = 12 - purchaseMonth + 1;

  // Degressive rate: 2x linear, max 20%
  const linearRate = 1 / usefulLifeYears;
  const degressiveRate = Math.min(linearRate * 2, 0.2);

  let currentValue = purchasePrice;
  let year = purchaseYear;
  let isFirstYear = true;

  while (currentValue > residualValue) {
    const remaining = roundCurrency(currentValue - residualValue);
    if (remaining <= 0.01) break;

    // Calculate remaining useful life for linear comparison
    const yearsElapsed = year - purchaseYear;
    const remainingYears = usefulLifeYears - yearsElapsed;

    if (remainingYears <= 0) {
      // Final year: depreciate remaining
      schedule.push({
        year,
        openingValue: roundCurrency(currentValue),
        depreciation: roundCurrency(remaining),
        closingValue: roundCurrency(residualValue),
      });
      break;
    }

    // Degressive amount
    const degressiveAmount = roundCurrency(currentValue * degressiveRate);

    // Linear amount on remaining value over remaining years
    const linearAmount = roundCurrency(remaining / remainingYears);

    // Switch to linear when it becomes more favorable
    let yearDepreciation: number;
    if (linearAmount >= degressiveAmount) {
      yearDepreciation = linearAmount;
    } else {
      yearDepreciation = degressiveAmount;
    }

    // Pro-rata for first year
    if (isFirstYear) {
      yearDepreciation = roundCurrency(
        (yearDepreciation * monthsInFirstYear) / 12
      );
      isFirstYear = false;
    }

    // Don't go below residual value
    yearDepreciation = Math.min(yearDepreciation, remaining);

    if (yearDepreciation <= 0) break;

    schedule.push({
      year,
      openingValue: roundCurrency(currentValue),
      depreciation: roundCurrency(yearDepreciation),
      closingValue: roundCurrency(currentValue - yearDepreciation),
    });

    currentValue = roundCurrency(currentValue - yearDepreciation);
    year++;
  }

  return schedule;
}

// ─── Current Year Depreciation ──────────────────────────────────

/**
 * Berechnet die AfA fuer ein bestimmtes Jahr.
 * Gibt 0 zurueck, wenn die Anlage in diesem Jahr nicht abgeschrieben wird.
 */
export function getDepreciationForYear(
  asset: {
    purchasePrice: number;
    purchaseDate: Date;
    usefulLifeYears: number;
    residualValue: number;
    depreciationMethod: string;
  },
  targetYear: number
): number {
  const schedule = calculateDepreciationSchedule(asset);
  const yearEntry = schedule.find((entry) => entry.year === targetYear);
  return yearEntry?.depreciation ?? 0;
}

// ─── Helpers ────────────────────────────────────────────────────

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
