/**
 * Book value and accumulated depreciation for display (not tax advice).
 * straight_line: equal monthly charge over useful life
 * reducing_balance: declining balance with rate = 1 - (S/C)^(1/n) when salvage S>0, else 2/n capped at 1
 */

function parseDate(d) {
  if (!d) return null;
  const s = String(d);
  return new Date(s.length <= 10 ? `${s}T12:00:00Z` : s);
}

/**
 * @param {object} row - asset row (snake_case from DB)
 * @returns {object} depreciation snapshot for API
 */
function depreciationSnapshot(row) {
  const cost = row.purchase_cost != null ? Number(row.purchase_cost) : null;
  const salvage = row.salvage_value != null ? Number(row.salvage_value) : 0;
  const life = row.useful_life_years != null ? parseInt(String(row.useful_life_years), 10) : null;
  const method = row.depreciation_method || 'straight_line';
  const pd = row.purchase_date;

  const out = {
    depreciable_base: null,
    annual_depreciation: null,
    monthly_depreciation: null,
    months_in_service: null,
    accumulated_depreciation: null,
    book_value: cost != null ? roundMoney(cost) : null,
    salvage_value: salvage,
    method,
    is_depreciating: false,
  };

  if (method === 'none') {
    if (row.current_value != null && row.current_value !== '') {
      out.book_value = roundMoney(Number(row.current_value));
    } else if (cost != null) {
      out.book_value = roundMoney(cost);
    }
    return out;
  }

  if (cost == null || !(cost > 0) || life == null || !(life > 0) || !pd) {
    if (row.current_value != null && row.current_value !== '') {
      out.book_value = roundMoney(Number(row.current_value));
    }
    return out;
  }

  const depreciable = Math.max(0, cost - salvage);
  out.depreciable_base = roundMoney(depreciable);
  out.is_depreciating = true;

  const start = parseDate(pd);
  const now = new Date();
  if (!start || Number.isNaN(start.getTime())) {
    return out;
  }

  if (now < start) {
    out.months_in_service = 0;
    out.accumulated_depreciation = 0;
    out.book_value = roundMoney(cost);
    out.annual_depreciation = roundMoney(depreciable / life);
    out.monthly_depreciation = roundMoney(depreciable / (life * 12));
    return out;
  }

  let monthsElapsed =
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) monthsElapsed -= 1;
  monthsElapsed = Math.max(0, monthsElapsed);
  out.months_in_service = monthsElapsed;

  const maxMonths = life * 12;
  const cappedMonths = Math.min(monthsElapsed, maxMonths);

  if (method === 'straight_line') {
    out.monthly_depreciation = roundMoney(depreciable / maxMonths);
    out.annual_depreciation = roundMoney(depreciable / life);
    let acc = out.monthly_depreciation * cappedMonths;
    if (acc > depreciable) acc = depreciable;
    out.accumulated_depreciation = roundMoney(acc);
    let bv = cost - out.accumulated_depreciation;
    if (bv < salvage) {
      bv = salvage;
      out.accumulated_depreciation = roundMoney(cost - salvage);
    }
    out.book_value = roundMoney(bv);
    return out;
  }

  if (method === 'reducing_balance') {
    let annualRate;
    if (salvage > 0 && cost > salvage) {
      annualRate = 1 - Math.pow(salvage / cost, 1 / life);
    } else {
      annualRate = Math.min(1, 2 / life);
    }
    const monthlyRate = 1 - Math.pow(1 - annualRate, 1 / 12);
    let bv = cost;
    let totalAcc = 0;
    for (let m = 0; m < cappedMonths && bv > salvage + 0.005; m++) {
      const dep = bv * monthlyRate;
      const cap = bv - salvage;
      const d = dep > cap ? cap : dep;
      totalAcc += d;
      bv -= d;
    }
    out.accumulated_depreciation = roundMoney(Math.min(totalAcc, depreciable));
    out.book_value = roundMoney(Math.max(bv, salvage));
    out.annual_depreciation = roundMoney(annualRate * cost);
    out.monthly_depreciation = null;
    return out;
  }

  return out;
}

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

function attachDepreciation(row) {
  if (!row) return row;
  const dep = depreciationSnapshot(row);
  return { ...row, depreciation: dep };
}

module.exports = { depreciationSnapshot, attachDepreciation };
