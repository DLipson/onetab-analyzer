# OneTab Analyzer

A Node.js CLI tool for analyzing and cleaning up [OneTab](https://www.one-tab.com/) browser extension exports. Parses exported tab lists, groups URLs by domain, and provides an interactive interface to review and selectively remove entire domains.

## Usage

```bash
# Show help
node onetab-analyzer.js --help

# Analyze an export (default threshold: 3+ URLs per domain)
node onetab-analyzer.js tabs.txt

# Only show domains with 5+ URLs
node onetab-analyzer.js tabs.txt --threshold 5

# Run built-in tests
node onetab-analyzer.js --test
```

## Features

### Domain Extraction

Extracts the registrable domain from each URL, with special handling for multi-part TLDs:

- Standard domains: `https://blog.example.com/page` -> `example.com`
- Multi-part TLDs: `https://www.bbc.co.uk/news` -> `bbc.co.uk`
- Platform subdomains: `https://user.github.io/repo` -> `user.github.io`

Supported multi-part TLDs: `.co.uk`, `.co.nz`, `.co.jp`, `.co.il`, `.com.au`, `.com.br`, `.org.uk`, `github.io`, `gitlab.io`, `vercel.app`, `netlify.app`.

### Line Parsing

Parses OneTab's export format (`URL | Title`):

- Only processes lines starting with `http://` or `https://`
- Splits on ` | ` to separate URL from title
- Preserves multiple pipes in titles (e.g., `A | B` stays intact)
- Skips blank lines and non-URL text
- Handles both Unix and Windows line endings

### Visual Domain List

Displays domains sorted by URL count, showing:

- Numbered index for quick reference
- Domain name
- URL count
- Proportional bar chart
- Red `[DELETE]` marker for domains flagged for removal

### Interactive Commands

| Command | Description |
|---|---|
| `s <N\|domain>` | Show all URLs and titles for a domain (by list number or partial name match). Accepts multiple items separated by hyphens (e.g. `s 1-3-7`) |
| `d <N\|domain>` | Mark a domain for deletion. Accepts multiple items separated by hyphens (e.g. `d 1-5-12`) |
| `u <N\|domain>` | Remove the deletion mark from a domain |
| `v <filename\|def>` | Save a filtered export without deleted domains. Pass `def` to use the default filename `cleaned.txt`. Refuses to overwrite the input file |
| `t <N>` | Change the minimum URL count for domains to appear in the list |
| `q` | Quit |

Domain resolution is flexible -- you can type a number from the list, the exact domain, or a substring match (e.g., `show git` matches `github.com`).

## Typical Workflow

1. Export your tabs from OneTab (produces a `.txt` file)
2. Run `node onetab-analyzer.js export.txt`
3. Review the domain list sorted by frequency
4. `s 1` to inspect the top domain's URLs
5. `d 1` to mark it for removal
6. Repeat for other unwanted domains
7. `v def` to write the filtered export (saves as `cleaned.txt`)
8. Import `cleaned.txt` back into OneTab or use it however you like
