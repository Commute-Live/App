#!/usr/bin/env node

const DEFAULT_BASE_URL = 'https://staging.commutelive.com';

const usage = `
Usage:
  node scripts/audit-cta-l-api-combinations.mjs [options]

Options:
  --base <url>          API base URL. Defaults to ${DEFAULT_BASE_URL}
  --line <id[,id]>      Only audit specific CTA L lines, like RED or RED,BLUE
  --station <stopId>    Only audit combinations that include this station stopId
  --concurrency <n>     Max concurrent API requests. Defaults to 6
  --timeout-ms <n>      Per-request timeout. Defaults to 12000
  --no-arrivals         Skip realtime arrival endpoint calls
  --json <path>         Write the full audit report as JSON
  --help                Show this help

Examples:
  npm run audit:cta-l-api
  npm run audit:cta-l-api -- --line RED --station 40900
  npm run audit:cta-l-api -- --no-arrivals --json /tmp/cta-l-audit.json
`;

const parseArgs = (argv) => {
  const options = {
    base: DEFAULT_BASE_URL,
    lines: null,
    station: null,
    concurrency: 6,
    timeoutMs: 12000,
    arrivals: true,
    jsonPath: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === '--help' || arg === '-h') {
      console.log(usage.trim());
      process.exit(0);
    }

    if (arg === '--base') {
      options.base = requireValue(arg, next);
      index += 1;
      continue;
    }

    if (arg === '--line') {
      options.lines = requireValue(arg, next)
        .split(',')
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean);
      index += 1;
      continue;
    }

    if (arg === '--station') {
      options.station = requireValue(arg, next).trim();
      index += 1;
      continue;
    }

    if (arg === '--concurrency') {
      options.concurrency = Math.max(1, Number.parseInt(requireValue(arg, next), 10));
      index += 1;
      continue;
    }

    if (arg === '--timeout-ms') {
      options.timeoutMs = Math.max(1000, Number.parseInt(requireValue(arg, next), 10));
      index += 1;
      continue;
    }

    if (arg === '--no-arrivals') {
      options.arrivals = false;
      continue;
    }

    if (arg === '--json') {
      options.jsonPath = requireValue(arg, next);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isFinite(options.concurrency)) options.concurrency = 6;
  if (!Number.isFinite(options.timeoutMs)) options.timeoutMs = 12000;

  return options;
};

const requireValue = (name, value) => {
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} requires a value`);
  }
  return value;
};

const normalizeBaseUrl = (value) => value.replace(/\/+$/, '');

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

const buildUrl = (base, path, query = {}) => {
  const url = new URL(path, `${base}/`);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url;
};

const fetchJson = async (base, path, query, context, timeoutMs) => {
  const url = buildUrl(base, path, query);
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();
    let body = null;

    if (text.length > 0) {
      try {
        body = JSON.parse(text);
      } catch {
        return {
          ok: false,
          status: response.status,
          url: url.toString(),
          context,
          durationMs: Date.now() - startedAt,
          error: 'Response was not valid JSON',
          body: text.slice(0, 1000),
        };
      }
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        url: url.toString(),
        context,
        durationMs: Date.now() - startedAt,
        error: describeBackendError(body) ?? response.statusText,
        body,
      };
    }

    return {
      ok: true,
      status: response.status,
      url: url.toString(),
      context,
      durationMs: Date.now() - startedAt,
      body,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      url: url.toString(),
      context,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : 'Request failed',
      body: null,
    };
  } finally {
    clearTimeout(timeout);
  }
};

const describeBackendError = (body) => {
  if (!isRecord(body)) return null;
  for (const key of ['error', 'message', 'detail']) {
    const value = body[key];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return null;
};

const runPool = async (items, concurrency, worker) => {
  const results = new Array(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
};

const addIssue = (report, issue) => {
  report.issues.push({
    severity: issue.severity ?? 'error',
    type: issue.type,
    message: issue.message,
    lineId: issue.lineId ?? null,
    patternId: issue.patternId ?? null,
    stopId: issue.stopId ?? null,
    url: issue.url ?? null,
    details: issue.details ?? null,
  });
};

const getLines = async (options, report) => {
  const result = await fetchJson(options.base, '/cta/stations/l/lines', {}, { api: 'lines' }, options.timeoutMs);
  report.requests.total += 1;
  if (!result.ok) {
    addIssue(report, {
      type: 'lines-request-failed',
      message: result.error,
      url: result.url,
      details: result.body,
    });
    return [];
  }

  if (!isRecord(result.body) || !Array.isArray(result.body.lines)) {
    addIssue(report, {
      type: 'lines-response-malformed',
      message: 'Expected /cta/stations/l/lines to return { lines: [] }',
      url: result.url,
      details: result.body,
    });
    return [];
  }

  const lines = result.body.lines.filter((line) => {
    if (!isRecord(line) || typeof line.id !== 'string') return false;
    if (!options.lines) return true;
    return options.lines.includes(line.id.toUpperCase());
  });

  if (options.lines) {
    const found = new Set(lines.map((line) => line.id.toUpperCase()));
    for (const lineId of options.lines) {
      if (!found.has(lineId)) {
        addIssue(report, {
          type: 'line-not-found',
          message: `Line ${lineId} was requested but not returned by the API`,
          lineId,
        });
      }
    }
  }

  return lines;
};

const getPatternStops = async (options, report, line, pattern) => {
  const result = await fetchJson(
    options.base,
    `/cta/stations/l/${encodeURIComponent(line.id)}/stopId`,
    {
      direction: pattern.direction,
      pattern: pattern.id,
    },
    { api: 'pattern-stops', lineId: line.id, patternId: pattern.id },
    options.timeoutMs,
  );
  report.requests.total += 1;
  report.requests.patternStops += 1;

  if (!result.ok) {
    addIssue(report, {
      type: 'pattern-stops-request-failed',
      message: result.error,
      lineId: line.id,
      patternId: pattern.id,
      url: result.url,
      details: result.body,
    });
    return [];
  }

  if (!isRecord(result.body) || !Array.isArray(result.body.stations)) {
    addIssue(report, {
      type: 'pattern-stops-response-malformed',
      message: 'Expected pattern stop endpoint to return { stations: [] }',
      lineId: line.id,
      patternId: pattern.id,
      url: result.url,
      details: result.body,
    });
    return [];
  }

  const stops = result.body.stations.filter((station) => isRecord(station) && typeof station.stopId === 'string');
  validatePatternStops(report, line, pattern, stops, result.url);
  return stops;
};

const validatePatternStops = (report, line, pattern, stops, url) => {
  if (stops.length === 0) {
    addIssue(report, {
      type: 'pattern-has-no-stops',
      message: 'Pattern endpoint returned zero stops',
      lineId: line.id,
      patternId: pattern.id,
      url,
    });
    return;
  }

  if (Number.isFinite(pattern.stopCount) && pattern.stopCount !== stops.length) {
    addIssue(report, {
      severity: 'warning',
      type: 'pattern-stop-count-mismatch',
      message: `Pattern says ${pattern.stopCount} stops but endpoint returned ${stops.length}`,
      lineId: line.id,
      patternId: pattern.id,
      url,
    });
  }

  const first = stops[0];
  const last = stops[stops.length - 1];
  if (pattern.firstStopId && first.stopId !== pattern.firstStopId) {
    addIssue(report, {
      type: 'pattern-first-stop-mismatch',
      message: `First stop was ${first.stopId} but pattern expected ${pattern.firstStopId}`,
      lineId: line.id,
      patternId: pattern.id,
      stopId: first.stopId,
      url,
    });
  }

  if (pattern.lastStopId && last.stopId !== pattern.lastStopId) {
    addIssue(report, {
      type: 'pattern-last-stop-mismatch',
      message: `Last stop was ${last.stopId} but pattern expected ${pattern.lastStopId}`,
      lineId: line.id,
      patternId: pattern.id,
      stopId: last.stopId,
      url,
    });
  }

  const seen = new Set();
  for (const stop of stops) {
    if (seen.has(stop.stopId)) {
      addIssue(report, {
        severity: 'warning',
        type: 'duplicate-stop-in-pattern',
        message: `Pattern contains duplicate stop ${stop.stopId}`,
        lineId: line.id,
        patternId: pattern.id,
        stopId: stop.stopId,
        url,
      });
    }
    seen.add(stop.stopId);
  }
};

const getStationLines = async (options, report, stopId) => {
  if (report.stationLineCache.has(stopId)) return report.stationLineCache.get(stopId);

  const result = await fetchJson(
    options.base,
    `/cta/stations/l/${encodeURIComponent(stopId)}/lines`,
    {},
    { api: 'station-lines', stopId },
    options.timeoutMs,
  );
  report.requests.total += 1;
  report.requests.stationLines += 1;

  if (!result.ok) {
    addIssue(report, {
      type: 'station-lines-request-failed',
      message: result.error,
      stopId,
      url: result.url,
      details: result.body,
    });
    report.stationLineCache.set(stopId, []);
    return [];
  }

  if (!isRecord(result.body) || !Array.isArray(result.body.lines)) {
    addIssue(report, {
      type: 'station-lines-response-malformed',
      message: 'Expected station lines endpoint to return { lines: [] }',
      stopId,
      url: result.url,
      details: result.body,
    });
    report.stationLineCache.set(stopId, []);
    return [];
  }

  const lines = result.body.lines
    .filter((line) => isRecord(line) && typeof line.id === 'string')
    .map((line) => line.id.toUpperCase());
  report.stationLineCache.set(stopId, lines);
  return lines;
};

const getArrivals = async (options, report, line, pattern, stop) => {
  const lineStats = getArrivalLineStats(report, line.id);
  lineStats.combinations += 1;

  const result = await fetchJson(
    options.base,
    `/cta/stations/l/${encodeURIComponent(stop.stopId)}/arrivals`,
    {
      line_ids: line.id,
      direction: pattern.direction,
      limit_per_line: 3,
    },
    {
      api: 'arrivals',
      lineId: line.id,
      patternId: pattern.id,
      stopId: stop.stopId,
      direction: pattern.direction,
    },
    options.timeoutMs,
  );
  report.requests.total += 1;
  report.requests.arrivals += 1;

  if (!result.ok) {
    lineStats.failedRequests += 1;
    addIssue(report, {
      type: 'arrivals-request-failed',
      message: result.error,
      lineId: line.id,
      patternId: pattern.id,
      stopId: stop.stopId,
      url: result.url,
      details: result.body,
    });
    return;
  }

  if (!isRecord(result.body) || !Array.isArray(result.body.groups)) {
    lineStats.failedRequests += 1;
    addIssue(report, {
      type: 'arrivals-response-malformed',
      message: 'Expected arrivals endpoint to return { groups: [] }',
      lineId: line.id,
      patternId: pattern.id,
      stopId: stop.stopId,
      url: result.url,
      details: result.body,
    });
    return;
  }

  const group = result.body.groups.find((item) => isRecord(item) && String(item.lineId).toUpperCase() === line.id.toUpperCase());
  if (!group) {
    lineStats.failedRequests += 1;
    addIssue(report, {
      type: 'arrivals-line-group-missing',
      message: `Arrivals response did not include a group for ${line.id}`,
      lineId: line.id,
      patternId: pattern.id,
      stopId: stop.stopId,
      url: result.url,
      details: result.body,
    });
    return;
  }

  if (typeof group.error === 'string' && group.error.trim().length > 0) {
    lineStats.providerErrors += 1;
    addIssue(report, {
      type: 'arrivals-provider-error',
      message: group.error.trim(),
      lineId: line.id,
      patternId: pattern.id,
      stopId: stop.stopId,
      url: result.url,
      details: group,
    });
  }

  if (!Array.isArray(group.arrivals)) {
    lineStats.failedRequests += 1;
    addIssue(report, {
      type: 'arrivals-array-missing',
      message: 'Arrivals group did not include an arrivals array',
      lineId: line.id,
      patternId: pattern.id,
      stopId: stop.stopId,
      url: result.url,
      details: group,
    });
    return;
  }

  if (group.arrivals.length === 0) {
    lineStats.emptyResponses += 1;
    return;
  }

  lineStats.responsesWithArrivals += 1;
  lineStats.arrivalRows += group.arrivals.length;

  for (const arrival of group.arrivals) {
    if (!isRecord(arrival) || typeof arrival.arrivalTime !== 'string' || Number.isNaN(Date.parse(arrival.arrivalTime))) {
      lineStats.invalidArrivalTimes += 1;
      addIssue(report, {
        type: 'arrival-time-invalid',
        message: 'Arrival row had missing or invalid arrivalTime',
        lineId: line.id,
        patternId: pattern.id,
        stopId: stop.stopId,
        url: result.url,
        details: arrival,
      });
    }
  }
};

const getArrivalLineStats = (report, lineId) => {
  if (!report.arrivalStats.byLine[lineId]) {
    report.arrivalStats.byLine[lineId] = {
      combinations: 0,
      responsesWithArrivals: 0,
      emptyResponses: 0,
      arrivalRows: 0,
      invalidArrivalTimes: 0,
      providerErrors: 0,
      failedRequests: 0,
    };
  }
  return report.arrivalStats.byLine[lineId];
};

const buildCombinations = (options, report, line, pattern, stops) => {
  return stops
    .filter((stop) => !options.station || stop.stopId === options.station)
    .map((stop) => ({
      line,
      pattern,
      stop,
    }));
};

const printIssueSummary = (report) => {
  const errors = report.issues.filter((issue) => issue.severity !== 'warning');
  const warnings = report.issues.filter((issue) => issue.severity === 'warning');

  console.log('');
  console.log('CTA L API audit complete');
  console.log(`Base URL: ${report.base}`);
  console.log(`Lines: ${report.counts.lines}`);
  console.log(`Patterns: ${report.counts.patterns}`);
  console.log(`Combinations: ${report.counts.combinations}`);
  console.log(`Requests: ${report.requests.total} total, ${report.requests.patternStops} pattern stops, ${report.requests.stationLines} station lines, ${report.requests.arrivals} arrivals`);
  console.log(`Issues: ${errors.length} errors, ${warnings.length} warnings`);

  if (report.arrivalStats.enabled) {
    const totalRows = Object.values(report.arrivalStats.byLine).reduce((sum, stats) => sum + stats.arrivalRows, 0);
    const invalidRows = Object.values(report.arrivalStats.byLine).reduce((sum, stats) => sum + stats.invalidArrivalTimes, 0);
    console.log(`Arrival rows: ${totalRows} total, ${invalidRows} invalid arrivalTime values`);
    console.log('');
    console.log('Arrival summary by line:');
    for (const [lineId, stats] of Object.entries(report.arrivalStats.byLine).sort(([a], [b]) => a.localeCompare(b))) {
      console.log(
        `  ${lineId}: ${stats.arrivalRows} rows from ${stats.responsesWithArrivals}/${stats.combinations} combinations, ` +
          `${stats.emptyResponses} empty, ${stats.providerErrors} provider errors, ${stats.failedRequests} failed requests`,
      );
    }
  }

  if (report.issues.length === 0) return;

  console.log('');
  for (const issue of report.issues.slice(0, 50)) {
    const scope = [
      issue.lineId ? `line=${issue.lineId}` : null,
      issue.patternId ? `pattern=${issue.patternId}` : null,
      issue.stopId ? `stop=${issue.stopId}` : null,
    ]
      .filter(Boolean)
      .join(' ');
    console.log(`[${issue.severity}] ${issue.type}${scope ? ` (${scope})` : ''}: ${issue.message}`);
    if (issue.url) console.log(`  ${issue.url}`);
  }

  if (report.issues.length > 50) {
    console.log(`... ${report.issues.length - 50} more issues omitted from console output`);
  }
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  options.base = normalizeBaseUrl(options.base);

  const report = {
    base: options.base,
    startedAt: new Date().toISOString(),
    options: {
      lines: options.lines,
      station: options.station,
      concurrency: options.concurrency,
      timeoutMs: options.timeoutMs,
      arrivals: options.arrivals,
    },
    counts: {
      lines: 0,
      patterns: 0,
      combinations: 0,
    },
    requests: {
      total: 0,
      patternStops: 0,
      stationLines: 0,
      arrivals: 0,
    },
    issues: [],
    arrivalStats: {
      enabled: options.arrivals,
      byLine: {},
    },
    stationLineCache: new Map(),
  };

  console.log(`Auditing CTA L APIs at ${options.base}`);
  if (options.station) console.log(`Station filter: ${options.station}`);
  if (options.lines) console.log(`Line filter: ${options.lines.join(', ')}`);
  if (!options.arrivals) console.log('Realtime arrival calls are disabled');

  const lines = await getLines(options, report);
  report.counts.lines = lines.length;

  const patternJobs = [];
  for (const line of lines) {
    const patterns = Array.isArray(line.patterns) ? line.patterns.filter((pattern) => isRecord(pattern) && typeof pattern.id === 'string') : [];
    if (patterns.length === 0) {
      addIssue(report, {
        type: 'line-patterns-missing',
        message: 'Line returned no patterns',
        lineId: line.id,
      });
    }

    for (const pattern of patterns) {
      patternJobs.push({ line, pattern });
    }
  }
  report.counts.patterns = patternJobs.length;

  const comboGroups = await runPool(patternJobs, options.concurrency, async ({ line, pattern }, index) => {
    if (index > 0 && index % 10 === 0) {
      console.log(`Checked ${index}/${patternJobs.length} pattern stop lists...`);
    }
    const stops = await getPatternStops(options, report, line, pattern);
    return buildCombinations(options, report, line, pattern, stops);
  });

  const combinations = comboGroups.flat();
  report.counts.combinations = combinations.length;

  if (options.station && combinations.length === 0) {
    addIssue(report, {
      type: 'station-not-in-selected-patterns',
      message: `No audited line pattern included station ${options.station}`,
      stopId: options.station,
    });
  }

  console.log(`Built ${combinations.length} station/line/direction combinations`);

  await runPool(combinations, options.concurrency, async ({ line, pattern, stop }, index) => {
    if (index > 0 && index % 50 === 0) {
      console.log(`Checked ${index}/${combinations.length} combinations...`);
    }

    const stationLines = await getStationLines(options, report, stop.stopId);
    if (!stationLines.includes(line.id.toUpperCase())) {
      addIssue(report, {
        type: 'station-line-membership-missing',
        message: `Station lines endpoint did not include ${line.id}`,
        lineId: line.id,
        patternId: pattern.id,
        stopId: stop.stopId,
      });
    }

    if (options.arrivals) {
      await getArrivals(options, report, line, pattern, stop);
    }
  });

  report.finishedAt = new Date().toISOString();
  report.stationLineCache = Object.fromEntries(report.stationLineCache);
  printIssueSummary(report);

  if (options.jsonPath) {
    const fs = await import('node:fs/promises');
    await fs.writeFile(options.jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`Wrote JSON report to ${options.jsonPath}`);
  }

  const hasErrors = report.issues.some((issue) => issue.severity !== 'warning');
  process.exitCode = hasErrors ? 1 : 0;
};

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
