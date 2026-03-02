/* ============================================
   Lactate Threshold Calculator
   Pure JS: polynomial fitting, OBLA, Dmax, ModDmax, Log-log
   Canvas chart rendering, editable data table UI
   Primary axis: pace (via equivalent flat speed)
   ============================================ */

(function () {
  'use strict';

  // --- Default data (Matt's graded exercise test, treadmill) ---
  // Stages 9.5–12.0 mph (+0.5 each), last stage 12.0 mph + 2% incline
  const DEFAULT_DATA = [
    { speed: 9.5,  grade: 0, hr: 156, lac: 0.3 },
    { speed: 10.0, grade: 0, hr: 163, lac: 0.4 },
    { speed: 10.5, grade: 0, hr: 168, lac: 1.6 },
    { speed: 11.0, grade: 0, hr: 175, lac: 1.9 },
    { speed: 11.5, grade: 0, hr: 181, lac: 2.2 },
    { speed: 12.0, grade: 0, hr: 186, lac: 4.3 },
    { speed: 12.0, grade: 2, hr: 191, lac: 6.1 },
  ];

  // ============================================
  // PACE / SPEED UTILITIES
  // ============================================

  /**
   * ACSM running VO2 equation to convert treadmill speed + grade
   * to equivalent flat running speed.
   * VO2 = 3.5 + 0.2 * speed(m/min) + 0.9 * speed(m/min) * grade(decimal)
   */
  function equivalentFlatSpeed(speedMph, gradePct) {
    if (!gradePct) return speedMph;
    const spm = speedMph * 26.8224; // mph to m/min
    const vo2 = 3.5 + 0.2 * spm + 0.9 * spm * (gradePct / 100);
    const flatSpm = (vo2 - 3.5) / 0.2;
    return flatSpm / 26.8224; // back to mph
  }

  /** Convert speed (mph) to pace string "M:SS /mi" */
  function speedToPace(mph) {
    if (!mph || mph <= 0) return '--:--';
    const totalSec = (60 / mph) * 60;
    const min = Math.floor(totalSec / 60);
    const sec = Math.round(totalSec % 60);
    return min + ':' + (sec < 10 ? '0' : '') + sec;
  }

  /** Convert pace "M:SS" to speed (mph). Returns NaN on bad input. */
  function paceToSpeed(paceStr) {
    const parts = paceStr.split(':');
    if (parts.length !== 2) return NaN;
    const min = parseInt(parts[0], 10);
    const sec = parseInt(parts[1], 10);
    if (isNaN(min) || isNaN(sec)) return NaN;
    const totalMin = min + sec / 60;
    return 60 / totalMin;
  }

  /**
   * Linear interpolation: given sorted parallel arrays (xs, ys),
   * find y at a given x value.
   */
  function linterp(xs, ys, x) {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
    for (let i = 1; i < xs.length; i++) {
      if (x <= xs[i]) {
        const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
        return ys[i - 1] + t * (ys[i] - ys[i - 1]);
      }
    }
    return ys[ys.length - 1];
  }

  // ============================================
  // MATH UTILITIES
  // ============================================

  /**
   * Fit a polynomial of given degree using least squares (normal equations).
   * Vandermonde matrix + Gaussian elimination with partial pivoting.
   * Returns coefficients [a0, a1, a2, ..., an] where y = a0 + a1*x + ... + an*x^n
   */
  function polyFit(xs, ys, degree) {
    const n = xs.length;
    const m = degree + 1;

    const VtV = Array.from({ length: m }, () => new Float64Array(m));
    const VtY = new Float64Array(m);

    for (let i = 0; i < n; i++) {
      const row = new Float64Array(m);
      row[0] = 1;
      for (let j = 1; j < m; j++) row[j] = row[j - 1] * xs[i];
      for (let j = 0; j < m; j++) {
        for (let k = 0; k < m; k++) VtV[j][k] += row[j] * row[k];
        VtY[j] += row[j] * ys[i];
      }
    }

    const A = VtV.map((r) => Array.from(r));
    const b = Array.from(VtY);

    for (let col = 0; col < m; col++) {
      let maxVal = Math.abs(A[col][col]);
      let maxRow = col;
      for (let row = col + 1; row < m; row++) {
        if (Math.abs(A[row][col]) > maxVal) {
          maxVal = Math.abs(A[row][col]);
          maxRow = row;
        }
      }
      [A[col], A[maxRow]] = [A[maxRow], A[col]];
      [b[col], b[maxRow]] = [b[maxRow], b[col]];

      for (let row = col + 1; row < m; row++) {
        const factor = A[row][col] / A[col][col];
        for (let k = col; k < m; k++) A[row][k] -= factor * A[col][k];
        b[row] -= factor * b[col];
      }
    }

    const coeffs = new Array(m);
    for (let i = m - 1; i >= 0; i--) {
      let sum = b[i];
      for (let j = i + 1; j < m; j++) sum -= A[i][j] * coeffs[j];
      coeffs[i] = sum / A[i][i];
    }

    return coeffs;
  }

  function polyEval(coeffs, x) {
    let y = 0;
    let xp = 1;
    for (let i = 0; i < coeffs.length; i++) {
      y += coeffs[i] * xp;
      xp *= x;
    }
    return y;
  }

  function bisect(f, lo, hi, tol, maxIter) {
    tol = tol || 1e-8;
    maxIter = maxIter || 200;
    for (let i = 0; i < maxIter; i++) {
      const mid = (lo + hi) / 2;
      if (hi - lo < tol) return mid;
      if (f(lo) * f(mid) <= 0) hi = mid;
      else lo = mid;
    }
    return (lo + hi) / 2;
  }

  // ============================================
  // THRESHOLD METHODS
  // All methods work on (x, lactate) where x = equivalent flat speed.
  // ============================================

  /**
   * OBLA: find x where cubic polynomial crosses fixed lactate thresholds.
   */
  function calcOBLA(xs, lacs, coeffs) {
    const thresholds = [2.0, 2.5, 3.0, 3.5, 4.0];
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const results = [];

    for (const thr of thresholds) {
      const f = (x) => polyEval(coeffs, x) - thr;
      const fLo = f(xMin);
      const fHi = f(xMax);

      if (fLo * fHi > 0) {
        let found = false;
        const step = (xMax - xMin) / 500;
        for (let x = xMin; x < xMax; x += step) {
          if (f(x) * f(x + step) <= 0) {
            results.push({ threshold: thr, x: bisect(f, x, x + step) });
            found = true;
            break;
          }
        }
        if (!found) results.push({ threshold: thr, x: null });
      } else {
        results.push({ threshold: thr, x: bisect(f, xMin, xMax) });
      }
    }
    return results;
  }

  function calcDmax(xs, lacs, coeffs) {
    const x1 = xs[0];
    const y1 = polyEval(coeffs, x1);
    const x2 = xs[xs.length - 1];
    const y2 = polyEval(coeffs, x2);
    return dMaxFromLine(coeffs, x1, y1, x2, y2);
  }

  function calcModDmax(xs, lacs, coeffs) {
    let startIdx = 0;
    for (let i = 1; i < lacs.length; i++) {
      if (lacs[i] - lacs[i - 1] >= 0.4) {
        startIdx = Math.max(0, i - 1);
        break;
      }
    }

    const x1 = xs[startIdx];
    const y1 = polyEval(coeffs, x1);
    const x2 = xs[xs.length - 1];
    const y2 = polyEval(coeffs, x2);
    return { ...dMaxFromLine(coeffs, x1, y1, x2, y2), startIdx };
  }

  function dMaxFromLine(coeffs, x1, y1, x2, y2) {
    const m = (y2 - y1) / (x2 - x1);
    const a = 3 * coeffs[3];
    const b = 2 * coeffs[2];
    const c = coeffs[1] - m;

    const disc = b * b - 4 * a * c;
    let candidates = [];

    if (disc >= 0) {
      const sqrtDisc = Math.sqrt(disc);
      candidates.push((-b + sqrtDisc) / (2 * a));
      candidates.push((-b - sqrtDisc) / (2 * a));
    }

    const denom = Math.sqrt(1 + m * m);
    let bestX = null;
    let bestDist = -Infinity;

    for (const cx of candidates) {
      if (cx >= x1 && cx <= x2) {
        const py = polyEval(coeffs, cx);
        const dist = (py - y1 - m * (cx - x1)) / denom;
        if (Math.abs(dist) > Math.abs(bestDist)) {
          bestDist = dist;
          bestX = cx;
        }
      }
    }

    if (bestX === null) {
      const step = (x2 - x1) / 1000;
      for (let x = x1; x <= x2; x += step) {
        const py = polyEval(coeffs, x);
        const dist = Math.abs(py - y1 - m * (x - x1)) / denom;
        if (dist > bestDist) {
          bestDist = dist;
          bestX = x;
        }
      }
    }

    return {
      x: bestX,
      lac: bestX !== null ? polyEval(coeffs, bestX) : null,
      lineStart: { x: x1, y: y1 },
      lineEnd: { x: x2, y: y2 },
    };
  }

  function calcLogLog(xs, lacs) {
    const n = xs.length;
    if (n < 4) return { x: null };

    const logX = xs.map(Math.log);
    const logLac = lacs.map((l) => Math.log(Math.max(l, 0.01)));

    let bestRSS = Infinity;
    let bestBreak = 2;

    for (let bp = 2; bp <= n - 2; bp++) {
      const rss1 = linRegRSS(logX.slice(0, bp), logLac.slice(0, bp));
      const rss2 = linRegRSS(logX.slice(bp), logLac.slice(bp));
      const totalRSS = rss1 + rss2;
      if (totalRSS < bestRSS) {
        bestRSS = totalRSS;
        bestBreak = bp;
      }
    }

    return {
      x: Math.exp(logX[bestBreak]),
      breakIdx: bestBreak,
    };
  }

  /**
   * Baseline+: find x where polynomial crosses baseline + delta.
   * baseline = first lactate measurement. Deltas: +0.5 (LT1), +1.5 (LT2).
   */
  function calcBaselinePlus(xs, lacs, coeffs) {
    const baseline = lacs[0];
    const deltas = [0.5, 1.5];
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const results = [];

    for (const delta of deltas) {
      const target = baseline + delta;
      const f = (x) => polyEval(coeffs, x) - target;
      const fLo = f(xMin);
      const fHi = f(xMax);

      if (fLo * fHi > 0) {
        let found = false;
        const step = (xMax - xMin) / 500;
        for (let x = xMin; x < xMax; x += step) {
          if (f(x) * f(x + step) <= 0) {
            results.push({ delta, baseline, target, x: bisect(f, x, x + step) });
            found = true;
            break;
          }
        }
        if (!found) results.push({ delta, baseline, target, x: null });
      } else {
        results.push({ delta, baseline, target, x: bisect(f, xMin, xMax) });
      }
    }
    return results;
  }

  /**
   * LTP (Lactate Turning Points): two-breakpoint piecewise linear regression
   * on (speed, lactate). Splits data into 3 segments and finds the (bp1, bp2)
   * pair minimizing total RSS. Needs ≥6 data points.
   */
  function calcLTP(xs, lacs) {
    const n = xs.length;
    if (n < 6) return { ltp1: null, ltp2: null };

    let bestRSS = Infinity;
    let bestBp1 = null;
    let bestBp2 = null;

    for (let bp1 = 2; bp1 <= n - 4; bp1++) {
      for (let bp2 = bp1 + 2; bp2 <= n - 2; bp2++) {
        const rss1 = linRegRSS(xs.slice(0, bp1), lacs.slice(0, bp1));
        const rss2 = linRegRSS(xs.slice(bp1, bp2), lacs.slice(bp1, bp2));
        const rss3 = linRegRSS(xs.slice(bp2), lacs.slice(bp2));
        const totalRSS = rss1 + rss2 + rss3;
        if (totalRSS < bestRSS) {
          bestRSS = totalRSS;
          bestBp1 = bp1;
          bestBp2 = bp2;
        }
      }
    }

    if (bestBp1 === null) return { ltp1: null, ltp2: null };

    // Breakpoint speeds: average of the boundary points
    const ltp1Speed = (xs[bestBp1 - 1] + xs[bestBp1]) / 2;
    const ltp2Speed = (xs[bestBp2 - 1] + xs[bestBp2]) / 2;

    // Get lactate at breakpoints via linear interpolation of the piecewise fit
    const seg1 = linReg(xs.slice(0, bestBp1), lacs.slice(0, bestBp1));
    const seg2 = linReg(xs.slice(bestBp1, bestBp2), lacs.slice(bestBp1, bestBp2));
    const seg3 = linReg(xs.slice(bestBp2), lacs.slice(bestBp2));

    return {
      ltp1: {
        x: ltp1Speed,
        lac: seg1.intercept + seg1.slope * ltp1Speed,
        breakIdx: bestBp1,
      },
      ltp2: {
        x: ltp2Speed,
        lac: seg2.intercept + seg2.slope * ltp2Speed,
        breakIdx: bestBp2,
      },
      segments: [seg1, seg2, seg3],
      breakpoints: [bestBp1, bestBp2],
    };
  }

  function linReg(xs, ys) {
    const n = xs.length;
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (let i = 0; i < n; i++) {
      sx += xs[i]; sy += ys[i]; sxx += xs[i] * xs[i]; sxy += xs[i] * ys[i];
    }
    const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    const intercept = (sy - slope * sx) / n;
    return { slope, intercept };
  }

  function linRegRSS(xs, ys) {
    const { slope, intercept } = linReg(xs, ys);
    let rss = 0;
    for (let i = 0; i < xs.length; i++) {
      const r = ys[i] - (intercept + slope * xs[i]);
      rss += r * r;
    }
    return rss;
  }

  // ============================================
  // CANVAS CHART — x-axis is equivalent flat speed, labeled as pace
  // ============================================

  const CHART_COLORS = {
    bg: '#000000',
    grid: 'rgba(255,255,255,0.06)',
    axis: 'rgba(255,255,255,0.4)',
    axisLabel: 'rgba(255,255,255,0.4)',
    dataPoint: '#ffffff',
    dataPointStroke: 'rgba(255,255,255,0.3)',
    curve: 'rgba(255,255,255,0.6)',
    dmaxLine: 'rgba(255,255,255,0.25)',
    modDmaxLine: 'rgba(255,255,255,0.2)',
    thresholdMarker: 'rgba(255,255,255,0.85)',
    legend: 'rgba(255,255,255,0.5)',
  };

  function renderChart(canvas, speeds, lacs, coeffs, results) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const pad = { top: 30, right: 30, bottom: 50, left: 60 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    const sMin = Math.min(...speeds) - 0.5;
    const sMax = Math.max(...speeds) + 0.5;
    const lacMax = Math.max(...lacs, 7) * 1.1;
    const lacMin = 0;

    const toX = (s) => pad.left + ((s - sMin) / (sMax - sMin)) * plotW;
    const toY = (lac) => pad.top + plotH - ((lac - lacMin) / (lacMax - lacMin)) * plotH;

    ctx.clearRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = CHART_COLORS.grid;
    ctx.lineWidth = 1;

    // Horizontal grid (lactate)
    const lacStep = lacMax > 8 ? 2 : 1;
    for (let lac = 0; lac <= lacMax; lac += lacStep) {
      const y = toY(lac);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
    }

    // Vertical grid — tick at nice pace intervals (every 15 sec)
    // Generate pace ticks: find pace range, step by 15 seconds
    const paceMaxSec = (60 / sMin) * 60; // slowest pace (highest sec)
    const paceMinSec = (60 / sMax) * 60; // fastest pace (lowest sec)
    const paceTickSec = 15;
    const paceTicks = [];
    const startTick = Math.ceil(paceMinSec / paceTickSec) * paceTickSec;
    for (let ps = startTick; ps <= paceMaxSec; ps += paceTickSec) {
      const spd = 60 / (ps / 60); // convert pace-seconds back to mph
      if (spd >= sMin && spd <= sMax) {
        paceTicks.push({ speed: spd, paceSec: ps });
      }
    }

    for (const tick of paceTicks) {
      const x = toX(tick.speed);
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, pad.top + plotH);
      ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = CHART_COLORS.axis;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top);
    ctx.lineTo(pad.left, pad.top + plotH);
    ctx.lineTo(w - pad.right, pad.top + plotH);
    ctx.stroke();

    // X axis labels — pace
    ctx.fillStyle = CHART_COLORS.axisLabel;
    ctx.font = '11px JetBrains Mono, monospace';
    ctx.textAlign = 'center';

    for (const tick of paceTicks) {
      const min = Math.floor(tick.paceSec / 60);
      const sec = Math.round(tick.paceSec % 60);
      const label = min + ':' + (sec < 10 ? '0' : '') + sec;
      ctx.fillText(label, toX(tick.speed), pad.top + plotH + 18);
    }
    ctx.font = '11px Inter, sans-serif';
    ctx.fillText('Pace (min/mi)', pad.left + plotW / 2, h - 8);

    // Y axis (Lactate)
    ctx.textAlign = 'right';
    ctx.font = '11px Inter, sans-serif';
    for (let lac = 0; lac <= lacMax; lac += lacStep) {
      ctx.fillText(lac.toFixed(1), pad.left - 8, toY(lac) + 4);
    }
    ctx.save();
    ctx.translate(14, pad.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Lactate (mmol/L)', 0, 0);
    ctx.restore();

    // Polynomial curve
    if (coeffs) {
      ctx.strokeStyle = CHART_COLORS.curve;
      ctx.lineWidth = 2;
      ctx.beginPath();
      const steps = 200;
      for (let i = 0; i <= steps; i++) {
        const s = sMin + (i / steps) * (sMax - sMin);
        const lac = polyEval(coeffs, s);
        const x = toX(s);
        const y = toY(Math.max(lac, 0));
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Dmax baseline (dashed)
    if (results && results.dmax && results.dmax.x !== null) {
      const dm = results.dmax;
      ctx.strokeStyle = CHART_COLORS.dmaxLine;
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(toX(dm.lineStart.x), toY(dm.lineStart.y));
      ctx.lineTo(toX(dm.lineEnd.x), toY(dm.lineEnd.y));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ModDmax baseline
    if (results && results.modDmax && results.modDmax.x !== null) {
      const mdm = results.modDmax;
      ctx.strokeStyle = CHART_COLORS.modDmaxLine;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(toX(mdm.lineStart.x), toY(mdm.lineStart.y));
      ctx.lineTo(toX(mdm.lineEnd.x), toY(mdm.lineEnd.y));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Threshold markers
    if (results) {
      if (results.obla) {
        ctx.fillStyle = CHART_COLORS.thresholdMarker;
        for (const o of results.obla) {
          if (o.x === null) continue;
          const x = toX(o.x);
          const y = toY(o.threshold);
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.font = '9px JetBrains Mono, monospace';
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.textAlign = 'left';
          ctx.fillText(o.threshold.toFixed(1), x + 7, y + 3);
          ctx.fillStyle = CHART_COLORS.thresholdMarker;
        }
      }

      if (results.dmax && results.dmax.x !== null) {
        const dm = results.dmax;
        drawMarker(ctx, toX(dm.x), toY(dm.lac), 'D', CHART_COLORS.thresholdMarker);
      }

      if (results.modDmax && results.modDmax.x !== null) {
        const mdm = results.modDmax;
        drawMarker(ctx, toX(mdm.x), toY(mdm.lac), 'M', CHART_COLORS.thresholdMarker);
      }

      if (results.loglog && results.loglog.x !== null) {
        const ll = results.loglog;
        const llLac = coeffs ? polyEval(coeffs, ll.x) : 0;
        drawMarker(ctx, toX(ll.x), toY(llLac), 'L', CHART_COLORS.thresholdMarker);
      }

      // Baseline+ markers (small dots like OBLA, labeled with delta)
      if (results.baselinePlus) {
        ctx.fillStyle = CHART_COLORS.thresholdMarker;
        for (const bp of results.baselinePlus) {
          if (bp.x === null) continue;
          const x = toX(bp.x);
          const y = toY(bp.target);
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.font = '9px JetBrains Mono, monospace';
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.textAlign = 'left';
          ctx.fillText('+' + bp.delta.toFixed(1), x + 7, y + 3);
          ctx.fillStyle = CHART_COLORS.thresholdMarker;
        }
      }

      // LTP markers (diamonds labeled "1" and "2")
      if (results.ltp && results.ltp.ltp1) {
        drawMarker(ctx, toX(results.ltp.ltp1.x), toY(results.ltp.ltp1.lac), '1', CHART_COLORS.thresholdMarker);
      }
      if (results.ltp && results.ltp.ltp2) {
        drawMarker(ctx, toX(results.ltp.ltp2.x), toY(results.ltp.ltp2.lac), '2', CHART_COLORS.thresholdMarker);
      }
    }

    // Data points (on top)
    ctx.fillStyle = CHART_COLORS.dataPoint;
    ctx.strokeStyle = CHART_COLORS.dataPointStroke;
    ctx.lineWidth = 2;
    for (let i = 0; i < speeds.length; i++) {
      const x = toX(speeds[i]);
      const y = toY(lacs[i]);
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    drawLegend(ctx, pad.left, pad.top - 16, results);
  }

  function drawMarker(ctx, x, y, label, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - 6);
    ctx.lineTo(x + 5, y);
    ctx.lineTo(x, y + 6);
    ctx.lineTo(x - 5, y);
    ctx.closePath();
    ctx.fill();
    ctx.font = 'bold 9px Inter, sans-serif';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y + 3);
  }

  function drawLegend(ctx, x, y, results) {
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.fillStyle = CHART_COLORS.legend;
    ctx.textAlign = 'left';

    let cx = x;
    const items = [
      { symbol: 'circle', label: 'Data' },
      { symbol: 'line', label: 'Polynomial' },
    ];
    if (results && results.obla) items.push({ symbol: 'dot', label: 'OBLA' });
    if (results && results.baselinePlus) items.push({ symbol: 'dot', label: 'Bsln+' });
    if (results && results.dmax && results.dmax.x !== null) items.push({ symbol: 'diamond', label: 'Dmax' });
    if (results && results.modDmax && results.modDmax.x !== null) items.push({ symbol: 'diamond', label: 'ModDmax' });
    if (results && results.loglog && results.loglog.x !== null) items.push({ symbol: 'diamond', label: 'Log-log' });
    if (results && results.ltp && results.ltp.ltp1) items.push({ symbol: 'diamond', label: 'LTP' });

    for (const item of items) {
      if (item.symbol === 'circle') {
        ctx.fillStyle = CHART_COLORS.dataPoint;
        ctx.beginPath();
        ctx.arc(cx + 4, y, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (item.symbol === 'line') {
        ctx.strokeStyle = CHART_COLORS.curve;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, y);
        ctx.lineTo(cx + 10, y);
        ctx.stroke();
      } else if (item.symbol === 'dot') {
        ctx.fillStyle = CHART_COLORS.thresholdMarker;
        ctx.beginPath();
        ctx.arc(cx + 4, y, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (item.symbol === 'diamond') {
        ctx.fillStyle = CHART_COLORS.thresholdMarker;
        ctx.beginPath();
        ctx.moveTo(cx + 4, y - 4);
        ctx.lineTo(cx + 8, y);
        ctx.lineTo(cx + 4, y + 4);
        ctx.lineTo(cx, y);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = CHART_COLORS.legend;
      ctx.fillText(item.label, cx + 14, y + 3);
      cx += ctx.measureText(item.label).width + 28;
    }
  }

  // ============================================
  // UI LOGIC
  // ============================================

  let data = DEFAULT_DATA.map((d) => ({ ...d }));

  // Cached calculation state for resize redraws
  let lastCalc = null;

  function init() {
    const container = document.getElementById('lt-app');
    if (!container) return;

    buildTable();
    attachEvents();
  }

  function buildTable() {
    const tbody = document.getElementById('lt-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    data.forEach((d, i) => {
      const equivSpeed = equivalentFlatSpeed(d.speed, d.grade);
      const pace = speedToPace(equivSpeed);
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td><input type="number" class="lt-input lt-speed" data-idx="' + i + '" value="' + d.speed + '" step="0.5" min="1" max="20"></td>' +
        '<td><input type="number" class="lt-input lt-grade" data-idx="' + i + '" value="' + d.grade + '" step="1" min="0" max="15"></td>' +
        '<td class="lt-pace-cell">' + pace + '</td>' +
        '<td><input type="number" class="lt-input lt-hr" data-idx="' + i + '" value="' + d.hr + '" step="1" min="40" max="250"></td>' +
        '<td><input type="number" class="lt-input lt-lac" data-idx="' + i + '" value="' + d.lac + '" step="0.1" min="0" max="30"></td>' +
        '<td class="lt-row-num">' + (i + 1) + '</td>';
      tbody.appendChild(tr);
    });

    // Live pace update when speed/grade changes
    tbody.querySelectorAll('.lt-speed, .lt-grade').forEach((inp) => {
      inp.addEventListener('input', function () {
        const row = this.closest('tr');
        const speed = parseFloat(row.querySelector('.lt-speed').value) || 0;
        const grade = parseFloat(row.querySelector('.lt-grade').value) || 0;
        row.querySelector('.lt-pace-cell').textContent = speedToPace(equivalentFlatSpeed(speed, grade));
      });
    });
  }

  function readTable() {
    const rows = document.querySelectorAll('#lt-table-body tr');
    data = [];
    rows.forEach((row) => {
      const speed = parseFloat(row.querySelector('.lt-speed').value);
      const grade = parseFloat(row.querySelector('.lt-grade').value) || 0;
      const hr = parseFloat(row.querySelector('.lt-hr').value);
      const lac = parseFloat(row.querySelector('.lt-lac').value);
      if (!isNaN(speed) && !isNaN(hr) && !isNaN(lac)) {
        data.push({ speed, grade, hr, lac });
      }
    });
  }

  function addPoint() {
    readTable();
    const last = data[data.length - 1];
    data.push({
      speed: last ? last.speed + 0.5 : 10,
      grade: 0,
      hr: last ? last.hr + 5 : 160,
      lac: last ? +(last.lac + 0.5).toFixed(1) : 1.0,
    });
    buildTable();
  }

  function removePoint() {
    readTable();
    if (data.length > 3) {
      data.pop();
      buildTable();
    }
  }

  function calculate() {
    readTable();
    if (data.length < 4) {
      showError('Need at least 4 data points.');
      return;
    }

    // Compute equivalent flat speeds and sort by speed
    const processed = data.map((d) => ({
      ...d,
      equivSpeed: equivalentFlatSpeed(d.speed, d.grade),
    }));
    processed.sort((a, b) => a.equivSpeed - b.equivSpeed);

    // Update data and rebuild table in sorted order
    data = processed.map(({ equivSpeed, ...rest }) => rest);
    buildTable();

    const equivSpeeds = processed.map((d) => d.equivSpeed);
    const hrs = processed.map((d) => d.hr);
    const lacs = processed.map((d) => d.lac);

    // Fit cubic polynomial: equivalent speed → lactate
    const coeffs = polyFit(equivSpeeds, lacs, 3);

    // Run all methods
    const obla = calcOBLA(equivSpeeds, lacs, coeffs);
    const dmax = calcDmax(equivSpeeds, lacs, coeffs);
    const modDmax = calcModDmax(equivSpeeds, lacs, coeffs);
    const loglog = calcLogLog(equivSpeeds, lacs);
    const baselinePlus = calcBaselinePlus(equivSpeeds, lacs, coeffs);
    const ltp = calcLTP(equivSpeeds, lacs);

    const results = { obla, dmax, modDmax, loglog, baselinePlus, ltp };

    // Cache for resize redraws
    lastCalc = { equivSpeeds, hrs, lacs, coeffs, results };

    // Display results with pace + HR
    displayResults(results, equivSpeeds, hrs);

    // Show sections, then render chart
    const resultsSection = document.getElementById('lt-results-section');
    if (resultsSection) resultsSection.style.display = 'block';

    const chartSection = document.getElementById('lt-chart-section');
    if (chartSection) chartSection.style.display = 'block';

    requestAnimationFrame(function () {
      const canvas = document.getElementById('lt-chart');
      if (canvas) renderChart(canvas, equivSpeeds, lacs, coeffs, results);
    });

    clearError();
  }

  /**
   * Format a threshold result: pace as primary, HR as secondary.
   * speed = equivalent flat speed (mph), hrs/equivSpeeds = data for interpolation.
   */
  function formatResult(speed, equivSpeeds, hrs) {
    const pace = speedToPace(speed);
    const hr = Math.round(linterp(equivSpeeds, hrs, speed));
    return { pace, hr };
  }

  /** Return an LT badge HTML string, or empty string for ambiguous thresholds */
  function ltTag(type) {
    if (type === 'lt1') return '<span class="lt-tag lt-tag-lt1">LT1</span>';
    if (type === 'lt2') return '<span class="lt-tag lt-tag-lt2">LT2</span>';
    return '';
  }

  /** Map OBLA thresholds to LT tag type */
  function oblaLtType(threshold) {
    if (threshold <= 2.0) return 'lt1';
    if (threshold >= 3.5) return 'lt2';
    return null; // 2.5 and 3.0 are ambiguous
  }

  function displayResults(results, equivSpeeds, hrs) {
    // OBLA results
    const oblaGrid = document.getElementById('lt-obla-results');
    if (oblaGrid) {
      oblaGrid.innerHTML = '';
      for (const o of results.obla) {
        const card = document.createElement('div');
        card.className = 'lt-result-card';
        const tag = ltTag(oblaLtType(o.threshold));
        if (o.x !== null) {
          const r = formatResult(o.x, equivSpeeds, hrs);
          card.innerHTML =
            '<div class="lt-result-label">OBLA ' + o.threshold.toFixed(1) + tag + '</div>' +
            '<div class="lt-result-value">' + r.pace + ' <span class="lt-result-unit">/mi</span></div>' +
            '<div class="lt-result-sub">' + r.hr + ' bpm · ' + o.threshold.toFixed(1) + ' mmol/L</div>';
        } else {
          card.innerHTML =
            '<div class="lt-result-label">OBLA ' + o.threshold.toFixed(1) + tag + '</div>' +
            '<div class="lt-result-value lt-result-na">N/A</div>' +
            '<div class="lt-result-sub">outside data range</div>';
        }
        oblaGrid.appendChild(card);
      }
    }

    // Baseline+ results
    const bslnGrid = document.getElementById('lt-bsln-results');
    if (bslnGrid) {
      bslnGrid.innerHTML = '';
      for (const bp of results.baselinePlus) {
        const card = document.createElement('div');
        card.className = 'lt-result-card';
        const tag = ltTag(bp.delta <= 0.5 ? 'lt1' : 'lt2');
        if (bp.x !== null) {
          const r = formatResult(bp.x, equivSpeeds, hrs);
          const lac = polyEval(lastCalc.coeffs, bp.x);
          card.innerHTML =
            '<div class="lt-result-label">Baseline + ' + bp.delta.toFixed(1) + tag + '</div>' +
            '<div class="lt-result-value">' + r.pace + ' <span class="lt-result-unit">/mi</span></div>' +
            '<div class="lt-result-sub">' + r.hr + ' bpm · target ' + bp.target.toFixed(1) + ' mmol/L</div>';
        } else {
          card.innerHTML =
            '<div class="lt-result-label">Baseline + ' + bp.delta.toFixed(1) + tag + '</div>' +
            '<div class="lt-result-value lt-result-na">N/A</div>' +
            '<div class="lt-result-sub">outside data range</div>';
        }
        bslnGrid.appendChild(card);
      }
    }

    // Dmax
    const dmaxEl = document.getElementById('lt-dmax-result');
    if (dmaxEl) {
      if (results.dmax.x !== null) {
        const r = formatResult(results.dmax.x, equivSpeeds, hrs);
        dmaxEl.innerHTML =
          '<div class="lt-result-value">' + r.pace + ' <span class="lt-result-unit">/mi</span></div>' +
          '<div class="lt-result-sub">' + r.hr + ' bpm · ' + results.dmax.lac.toFixed(1) + ' mmol/L</div>';
      } else {
        dmaxEl.innerHTML = '<div class="lt-result-value lt-result-na">N/A</div>';
      }
    }

    // ModDmax
    const modDmaxEl = document.getElementById('lt-moddmax-result');
    if (modDmaxEl) {
      if (results.modDmax.x !== null) {
        const r = formatResult(results.modDmax.x, equivSpeeds, hrs);
        modDmaxEl.innerHTML =
          '<div class="lt-result-value">' + r.pace + ' <span class="lt-result-unit">/mi</span></div>' +
          '<div class="lt-result-sub">' + r.hr + ' bpm · ' + results.modDmax.lac.toFixed(1) + ' mmol/L</div>';
      } else {
        modDmaxEl.innerHTML = '<div class="lt-result-value lt-result-na">N/A</div>';
      }
    }

    // Log-log
    const loglogEl = document.getElementById('lt-loglog-result');
    if (loglogEl) {
      if (results.loglog.x !== null) {
        const r = formatResult(results.loglog.x, equivSpeeds, hrs);
        loglogEl.innerHTML =
          '<div class="lt-result-value">' + r.pace + ' <span class="lt-result-unit">/mi</span></div>' +
          '<div class="lt-result-sub">' + r.hr + ' bpm</div>';
      } else {
        loglogEl.innerHTML = '<div class="lt-result-value lt-result-na">N/A</div>';
      }
    }

    // LTP results
    const ltp1El = document.getElementById('lt-ltp1-result');
    if (ltp1El) {
      if (results.ltp.ltp1) {
        const r = formatResult(results.ltp.ltp1.x, equivSpeeds, hrs);
        ltp1El.innerHTML =
          '<div class="lt-result-value">' + r.pace + ' <span class="lt-result-unit">/mi</span></div>' +
          '<div class="lt-result-sub">' + r.hr + ' bpm · ' + results.ltp.ltp1.lac.toFixed(1) + ' mmol/L</div>';
      } else {
        ltp1El.innerHTML =
          '<div class="lt-result-value lt-result-na">N/A</div>' +
          '<div class="lt-result-sub">need ≥ 6 data points</div>';
      }
    }
    const ltp2El = document.getElementById('lt-ltp2-result');
    if (ltp2El) {
      if (results.ltp.ltp2) {
        const r = formatResult(results.ltp.ltp2.x, equivSpeeds, hrs);
        ltp2El.innerHTML =
          '<div class="lt-result-value">' + r.pace + ' <span class="lt-result-unit">/mi</span></div>' +
          '<div class="lt-result-sub">' + r.hr + ' bpm · ' + results.ltp.ltp2.lac.toFixed(1) + ' mmol/L</div>';
      } else {
        ltp2El.innerHTML =
          '<div class="lt-result-value lt-result-na">N/A</div>' +
          '<div class="lt-result-sub">need ≥ 6 data points</div>';
      }
    }
  }

  function showError(msg) {
    const el = document.getElementById('lt-error');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
  }

  function clearError() {
    const el = document.getElementById('lt-error');
    if (el) el.style.display = 'none';
  }

  function attachEvents() {
    const addBtn = document.getElementById('lt-add-btn');
    const removeBtn = document.getElementById('lt-remove-btn');
    const calcBtn = document.getElementById('lt-calc-btn');

    if (addBtn) addBtn.addEventListener('click', addPoint);
    if (removeBtn) removeBtn.addEventListener('click', removePoint);
    if (calcBtn) calcBtn.addEventListener('click', calculate);

    // Collapsible method panels
    document.querySelectorAll('.lt-method-toggle').forEach((btn) => {
      btn.addEventListener('click', function () {
        const wrapper = this.parentElement;
        const panel = wrapper.tagName === 'P' ? wrapper.nextElementSibling : this.nextElementSibling;
        if (!panel || !panel.classList.contains('lt-method-panel')) return;
        const isOpen = panel.classList.contains('lt-panel-open');
        panel.classList.toggle('lt-panel-open');
        this.classList.toggle('lt-toggle-open');
        panel.style.maxHeight = isOpen ? '0' : panel.scrollHeight + 'px';
      });
    });

    // Resize: redraw chart from cached state
    let resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (!lastCalc) return;
        const canvas = document.getElementById('lt-chart');
        const chartSection = document.getElementById('lt-chart-section');
        if (canvas && chartSection && chartSection.style.display !== 'none') {
          renderChart(canvas, lastCalc.equivSpeeds, lastCalc.lacs, lastCalc.coeffs, lastCalc.results);
        }
      }, 250);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
