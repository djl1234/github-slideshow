# CLAUDE.md

This file provides guidance for AI assistants working with this repository.

## Project Overview

GitHub Slideshow is an educational repository created for GitHub Learning Lab. It teaches Git and GitHub fundamentals through an interactive slide deck presentation built with **Jekyll** and **Reveal.js** (v3.9.2).

The site is designed to be deployed on **GitHub Pages**.

## Repository Structure

```
├── _config.yml            # Jekyll + Reveal.js configuration
├── _includes/             # Jekyll partial templates
│   ├── head.html          # HTML head (CSS, meta tags)
│   ├── script.html        # Reveal.js initialization
│   └── slide.html         # Individual slide template
├── _layouts/              # Page layouts
│   ├── presentation.html  # Main slideshow layout
│   ├── print.html         # Print-friendly layout
│   └── slide.html         # Single slide layout
├── _posts/                # Slide content (Markdown files)
├── index.html             # Entry point (uses presentation layout)
├── script/                # Development utility scripts
│   ├── cibuild            # CI build + HTML validation
│   ├── server             # Local dev server
│   ├── setup              # Environment setup
│   └── stage              # Staging deployment
├── Gemfile                # Ruby dependencies
├── Gemfile.lock           # Locked gem versions
├── node_modules/          # NPM dependencies (reveal.js)
├── package-lock.json      # NPM lock file
├── .editorconfig          # Editor style rules
└── .gitignore             # Ignored files (_site/, .sass-cache/, etc.)
```

## Tech Stack

- **Static site generator:** Jekyll 3.9.0 (via `github-pages` gem v207+)
- **Presentation framework:** Reveal.js v3.9.2
- **Ruby gems:** Managed via Bundler (`Gemfile` / `Gemfile.lock`)
- **NPM:** Used only for the reveal.js dependency
- **Syntax highlighting:** Rouge (Jekyll) + Monokai (Reveal.js)
- **Markdown processor:** Kramdown
- **HTML validation:** html-proofer

## Development Commands

### Setup
```bash
script/setup      # Install dependencies (Bundler + submodules)
```

### Local Development
```bash
script/server     # Runs `bundle exec jekyll serve` with live reload
```

### CI Build
```bash
script/cibuild    # Builds site and validates HTML with htmlproofer
```

This runs:
1. `bundle exec jekyll build --baseurl "."`
2. `htmlproofer _site/index.html --empty-alt-ignore`

### Staging
```bash
script/stage      # Builds and deploys to internal staging (ghe.io)
```

## Adding Slides

Slides are Markdown files in `_posts/` using Jekyll's date-based naming convention:

**Filename format:** `YYYY-MM-DD-slug.md`

**Required frontmatter:**
```markdown
---
layout: slide
title: "Slide Title"
---

Slide content in Markdown
```

Posts are rendered in filename order. The date prefix controls ordering (use `0000-01-XX` for fixed ordering).

## Template Rendering Pipeline

1. `index.html` uses the `presentation` layout
2. `_layouts/presentation.html` loops through all posts, including `slide.html` for each
3. `_includes/slide.html` renders each post as a `<section>` element
4. `_includes/head.html` loads CSS and meta configuration
5. `_includes/script.html` initializes Reveal.js with settings from `_config.yml`

## Key Configuration (_config.yml)

- **Theme:** Solarized Dark (`moon.css`)
- **Slide dimensions:** 1000x920
- **Transitions:** Linear (slides), Slide (backgrounds)
- **Controls:** Disabled (no arrow buttons)
- **Progress bar:** Enabled
- **Keyboard navigation:** Enabled
- **Browser history:** Enabled (URL updates per slide)
- **Slide numbers:** Shown as current/total

## Coding Conventions

- Follow `.editorconfig` rules:
  - Default: tabs, 4-space width, LF line endings, UTF-8
  - JSON/JS/CSS/HTML/YAML: spaces, 2-space indent
  - Markdown: spaces, 4-space indent
- Jekyll templates use Liquid syntax (`{{ }}`, `{% %}`)
- Slide-specific Reveal.js attributes can be set via frontmatter (e.g., `data-background`, `data-transition`)

## CI/CD

No GitHub Actions workflows are configured. The project relies on:
- GitHub Pages native Jekyll builds for deployment
- `script/cibuild` for local/CI validation

## License

MIT License (Copyright 2016 Thomas Friese)
