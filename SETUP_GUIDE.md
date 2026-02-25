# Don Q Website — Setup & Deployment Guide

## What You Have

This is a complete Hugo static site with:
- Dark theme matching your YouTube banner aesthetic (gold + dark + code blue)
- Two blog posts ready to go
- About page with your credentials
- KaTeX math rendering (LaTeX equations work in posts)
- Responsive design (looks good on mobile)
- Blog listing with tags

## Step 1: Install Hugo

**Mac (recommended):**
```bash
brew install hugo
```

**Windows:**
```bash
choco install hugo-extended
```

**Or download directly:**
https://github.com/gohugoio/hugo/releases
(Get the "extended" version)

Verify it works:
```bash
hugo version
```

## Step 2: Install Git (if you don't have it)

**Mac:**
```bash
# Git comes with Xcode command line tools
xcode-select --install
```

**Windows:**
Download from https://git-scm.com/downloads

## Step 3: Test Your Site Locally

1. Unzip the `donq-site` folder
2. Open terminal and navigate to it:
```bash
cd path/to/donq-site
```
3. Run the local server:
```bash
hugo server -D
```
4. Open your browser to http://localhost:1313
5. You should see your site! Make sure everything looks right.

## Step 4: Create a GitHub Repository

1. Go to https://github.com and sign in (create account if needed)
2. Click "New repository" (the + icon in top right)
3. Name it: `donq-site` (or whatever you want)
4. Make it **Public**
5. Do NOT initialize with README
6. Click "Create repository"

## Step 5: Push Your Site to GitHub

In your terminal, inside the donq-site folder:

```bash
git init
git add .
git commit -m "Initial commit - Don Q site launch"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/donq-site.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

## Step 6: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** → **Pages** (left sidebar)
3. Under "Source", select **GitHub Actions**
4. Create a new file in your repo at `.github/workflows/hugo.yml` with the content below

## Step 7: Create the GitHub Actions Workflow

Create this file at `.github/workflows/hugo.yml`:

```yaml
name: Deploy Hugo site to Pages

on:
  push:
    branches: ["main"]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

defaults:
  run:
    shell: bash

jobs:
  build:
    runs-on: ubuntu-latest
    env:
      HUGO_VERSION: 0.139.0
    steps:
      - name: Install Hugo CLI
        run: |
          wget -O ${{ runner.temp }}/hugo.deb https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/hugo_extended_${HUGO_VERSION}_linux-amd64.deb \
          && sudo dpkg -i ${{ runner.temp }}/hugo.deb
      - name: Checkout
        uses: actions/checkout@v4
        with:
          submodules: recursive
      - name: Setup Pages
        id: pages
        uses: actions/configure-pages@v5
      - name: Build with Hugo
        env:
          HUGO_CACHEDIR: ${{ runner.temp }}/hugo_cache
          HUGO_ENVIRONMENT: production
        run: |
          hugo \
            --minify \
            --baseURL "${{ steps.pages.outputs.base_url }}/"
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./public

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

## Step 8: Push and Deploy

```bash
git add .
git commit -m "Add GitHub Pages workflow"
git push
```

Wait 1-2 minutes, then check: `https://YOUR_USERNAME.github.io/donq-site/`

Your site is live!

## Step 9: Update hugo.toml

Once you know your URL, update the `baseURL` in `hugo.toml`:
```toml
baseURL = "https://YOUR_USERNAME.github.io/donq-site/"
```

## Adding New Blog Posts

1. Create a new .md file in `content/blog/`:
```bash
hugo new blog/my-new-post.md
```
2. Edit the file — add your content in Markdown
3. Math works with $inline$ and $$display$$ syntax
4. Push to GitHub:
```bash
git add .
git commit -m "New post: title"
git push
```
5. Site updates automatically in ~1 minute

## Custom Domain (Optional, Later)

When you buy a domain:
1. Add a `CNAME` file in `static/` with your domain
2. Update `baseURL` in hugo.toml
3. Configure DNS at your registrar to point to GitHub Pages
4. Enable HTTPS in GitHub Pages settings

## File Structure Reference

```
donq-site/
├── hugo.toml              ← Site config
├── content/
│   ├── blog/              ← Your blog posts go here
│   │   ├── _index.md
│   │   ├── strange-simplicity-of-machine-learning.md
│   │   └── bayesian-probability-is-statistics-even-real.md
│   └── about.md           ← About page
├── layouts/               ← HTML templates
│   ├── _default/
│   │   ├── baseof.html    ← Base template (nav, footer)
│   │   └── single.html    ← Single post layout
│   ├── blog/
│   │   └── list.html      ← Blog listing page
│   └── index.html         ← Homepage
└── static/
    └── css/
        └── style.css      ← All styles
```
