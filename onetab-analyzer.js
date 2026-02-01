#!/usr/bin/env node
const fs = require("fs");
const readline = require("readline");

// ─────────────────────────────────────────────────────────────────────────────
// Domain Extraction
// ─────────────────────────────────────────────────────────────────────────────

const MULTI_PART_TLDS = [
  "co.uk", "co.nz", "co.jp", "co.il",
  "com.au", "com.br", "org.uk",
  "github.io", "gitlab.io", "vercel.app", "netlify.app"
];

function extractDomain(urlString) {
  try {
    const hostname = new URL(urlString.trim()).hostname.toLowerCase();
    const parts = hostname.split(".");

    for (const tld of MULTI_PART_TLDS) {
      if (hostname.endsWith("." + tld)) {
        const tldPartCount = tld.split(".").length;
        return parts.slice(-(tldPartCount + 1)).join(".");
      }
    }

    return parts.slice(-2).join(".");
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Parsing
// ─────────────────────────────────────────────────────────────────────────────

function parseLine(line) {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.match(/^https?:\/\//i)) {
    return null;
  }

  const [urlPart, ...titleParts] = trimmed.split(" | ");
  const domain = extractDomain(urlPart);

  if (!domain) return null;

  return {
    url: urlPart.trim(),
    title: titleParts.join(" | ").trim(),
    domain,
    raw: line
  };
}

function parseFile(content) {
  return content
    .split(/\r?\n/)
    .map(parseLine)
    .filter(entry => entry !== null);
}

function groupByDomain(entries) {
  const groups = new Map();

  for (const entry of entries) {
    const list = groups.get(entry.domain) || [];
    list.push(entry);
    groups.set(entry.domain, list);
  }

  return groups;
}

// ─────────────────────────────────────────────────────────────────────────────
// Display
// ─────────────────────────────────────────────────────────────────────────────

const CYAN = "\x1b[36m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

function printDomainList(groups, threshold, markedForDeletion) {
  const sorted = [...groups.entries()]
    .filter(([_, entries]) => entries.length >= threshold)
    .sort((a, b) => b[1].length - a[1].length);

  if (sorted.length === 0) {
    console.log(`${DIM}No domains with ${threshold}+ URLs${RESET}\n`);
    return;
  }

  const maxCount = sorted[0][1].length;

  console.log(`\n${BOLD}Domains with ${threshold}+ URLs:${RESET}\n`);

  sorted.forEach(([domain, entries], index) => {
    const num = String(index + 1).padStart(3);
    const count = String(entries.length).padStart(4);
    const bar = "█".repeat(Math.ceil((entries.length / maxCount) * 15));
    const deleteMarker = markedForDeletion.has(domain) ? `${RED} [DELETE]${RESET}` : "";

    console.log(`  ${DIM}${num}.${RESET} ${CYAN}${domain.padEnd(30)}${RESET} ${YELLOW}${count}${RESET} ${GREEN}${bar}${RESET}${deleteMarker}`);
  });

  console.log();
}

function printUrls(domain, entries) {
  console.log(`\n${BOLD}URLs from ${CYAN}${domain}${RESET}${BOLD} (${entries.length}):${RESET}\n`);

  entries.forEach((entry, index) => {
    console.log(`  ${DIM}${index + 1}.${RESET} ${entry.url}`);
    if (entry.title) {
      console.log(`     ${DIM}${entry.title}${RESET}`);
    }
  });

  console.log();
}

function printHelp() {
  console.log(`
${BOLD}OneTab Analyzer${RESET}

Analyze OneTab exports, group URLs by domain, and remove unwanted domains.

${BOLD}Usage:${RESET}
  node onetab-analyzer.js <export.txt> [--threshold N]

${BOLD}Options:${RESET}
  --threshold N   Show domains with N+ URLs (default: 3)
  --test          Run tests
  --help          Show this help

${BOLD}Interactive Commands:${RESET}
  show <N|domain>     View all URLs for a domain (by number or name)
  delete <N|domain>   Mark domain for deletion
  undo <domain>       Unmark domain
  save <filename>     Save filtered export (without deleted domains)
  threshold <N>       Change threshold
  quit                Exit

${BOLD}Examples:${RESET}
  node onetab-analyzer.js tabs.txt
  node onetab-analyzer.js tabs.txt --threshold 5
`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Interactive Mode
// ─────────────────────────────────────────────────────────────────────────────

function resolveDomain(input, sortedDomains) {
  const num = parseInt(input, 10);
  if (!isNaN(num) && num >= 1 && num <= sortedDomains.length) {
    return sortedDomains[num - 1][0];
  }

  const lower = input.toLowerCase();
  const match = sortedDomains.find(([d]) => d === lower || d.includes(lower));
  return match?.[0] || null;
}

function prompt(rl, question) {
  return new Promise(resolve => rl.question(question, answer => resolve(answer.trim())));
}

async function runInteractive(entries, groups, initialThreshold, inputFile) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const markedForDeletion = new Set();
  let threshold = initialThreshold;

  const getSortedDomains = () => [...groups.entries()]
    .filter(([_, e]) => e.length >= threshold)
    .sort((a, b) => b[1].length - a[1].length);

  while (true) {
    console.clear();
    console.log(`${BOLD}OneTab Analyzer${RESET} - ${entries.length} URLs, ${groups.size} domains\n`);

    printDomainList(groups, threshold, markedForDeletion);

    console.log(`${DIM}Commands: show, delete, undo, save, threshold, quit${RESET}\n`);

    const input = await prompt(rl, `${BOLD}> ${RESET}`);
    const [command, ...args] = input.split(/\s+/);
    const arg = args.join(" ");

    const sortedDomains = getSortedDomains();

    switch (command?.toLowerCase()) {
      case "show":
      case "s": {
        const domain = resolveDomain(arg, sortedDomains);
        if (domain && groups.has(domain)) {
          printUrls(domain, groups.get(domain));
        } else {
          console.log(`${RED}Domain not found${RESET}`);
        }
        await prompt(rl, "Press Enter to continue...");
        break;
      }

      case "delete":
      case "d": {
        const domain = resolveDomain(arg, sortedDomains);
        if (domain) {
          markedForDeletion.add(domain);
          console.log(`${GREEN}Marked ${domain} for deletion${RESET}`);
        } else {
          console.log(`${RED}Domain not found${RESET}`);
        }
        await prompt(rl, "Press Enter to continue...");
        break;
      }

      case "undo":
      case "u": {
        const domain = resolveDomain(arg, sortedDomains) || arg.toLowerCase();
        if (markedForDeletion.has(domain)) {
          markedForDeletion.delete(domain);
          console.log(`${GREEN}Unmarked ${domain}${RESET}`);
        } else {
          console.log(`${RED}Domain not in deletion list${RESET}`);
        }
        await prompt(rl, "Press Enter to continue...");
        break;
      }

      case "save": {
        if (!arg) {
          console.log(`${RED}Please provide filename${RESET}`);
        } else if (markedForDeletion.size === 0) {
          console.log(`${YELLOW}No domains marked for deletion${RESET}`);
        } else if (arg === inputFile) {
          console.log(`${RED}Cannot overwrite input file${RESET}`);
        } else {
          const filtered = entries.filter(e => !markedForDeletion.has(e.domain));
          fs.writeFileSync(arg, filtered.map(e => e.raw).join("\n"));
          console.log(`${GREEN}Saved ${filtered.length} URLs to ${arg}${RESET}`);
          console.log(`${YELLOW}Removed ${entries.length - filtered.length} URLs${RESET}`);
        }
        await prompt(rl, "Press Enter to continue...");
        break;
      }

      case "threshold":
      case "t": {
        const newThreshold = parseInt(arg, 10);
        if (newThreshold > 0) {
          threshold = newThreshold;
        }
        break;
      }

      case "quit":
      case "q":
      case "exit":
        rl.close();
        return;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

function runTests() {
  let passed = 0;
  let failed = 0;

  function test(name, condition) {
    if (condition) {
      console.log(`${GREEN}✓${RESET} ${name}`);
      passed++;
    } else {
      console.log(`${RED}✗${RESET} ${name}`);
      failed++;
    }
  }

  console.log(`\n${BOLD}Running tests...${RESET}\n`);

  test("extracts simple domain",
    extractDomain("https://www.example.com/page") === "example.com");

  test("extracts subdomain correctly",
    extractDomain("https://blog.example.com") === "example.com");

  test("handles co.uk TLD",
    extractDomain("https://www.bbc.co.uk/news") === "bbc.co.uk");

  test("handles github.io",
    extractDomain("https://user.github.io/repo") === "user.github.io");

  test("returns null for invalid URL",
    extractDomain("not-a-url") === null);

  test("parses URL with title",
    (() => {
      const e = parseLine("https://example.com | My Title");
      return e?.url === "https://example.com" && e?.title === "My Title";
    })());

  test("parses URL without title",
    (() => {
      const e = parseLine("https://example.com");
      return e?.url === "https://example.com" && e?.title === "";
    })());

  test("handles emoji in title",
    parseLine("https://example.com | 💤 Sleep")?.title === "💤 Sleep");

  test("returns null for non-URL",
    parseLine("just some text") === null);

  test("returns null for empty line",
    parseLine("") === null);

  test("preserves multiple pipes in title",
    parseLine("https://example.com | A | B")?.title === "A | B");

  test("parses multiple lines",
    parseFile("https://a.com\nhttps://b.com").length === 2);

  test("skips malformed lines",
    parseFile("https://a.com\nbad line\nhttps://b.com").length === 2);

  test("handles Windows line endings",
    parseFile("https://a.com\r\nhttps://b.com").length === 2);

  test("groups by domain correctly",
    (() => {
      const entries = parseFile("https://github.com/a\nhttps://github.com/b\nhttps://other.com");
      const groups = groupByDomain(entries);
      return groups.get("github.com")?.length === 2 && groups.get("other.com")?.length === 1;
    })());

  console.log(`\n${BOLD}Results: ${passed} passed, ${failed} failed${RESET}\n`);

  if (failed > 0) process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--test")) {
    runTests();
    return;
  }

  if (args.includes("--help") || args.length === 0) {
    printHelp();
    return;
  }

  const inputFile = args.find(a => !a.startsWith("-"));
  const thresholdIndex = args.indexOf("--threshold");
  const threshold = thresholdIndex >= 0 ? parseInt(args[thresholdIndex + 1], 10) || 3 : 3;

  if (!fs.existsSync(inputFile)) {
    console.log(`${RED}File not found: ${inputFile}${RESET}`);
    process.exit(1);
  }

  const content = fs.readFileSync(inputFile, "utf-8");
  const entries = parseFile(content);
  const groups = groupByDomain(entries);

  await runInteractive(entries, groups, threshold, inputFile);
}

main();
