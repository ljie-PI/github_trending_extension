# GitHub Trending - Edge Extension

A modern browser extension that displays trending GitHub repositories with GitHub-style UI.

## Features

- **36+ Programming Languages**: Validated languages from TIOBE index + custom language support
- **GitHub-Style UI**: Repository icons, developer avatars, button groups matching GitHub design
- **Smart Time Ranges**: Today/This week/This month with instant cached switching
- **Progressive Loading**: Languages appear individually as they load
- **Efficient Performance**: 5-request concurrency limit, background preloading, 10-minute caching

## Installation

1. Open Edge/Chrome and go to `chrome://extensions/` or `edge://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select this directory

## Usage

- **Open new tab** - Extension loads automatically
- **Language Settings** - Click button to add/remove languages (only new languages reload)
- **Time Ranges** - Use Today/This week/This month buttons (preloaded data switches instantly)
- **Repository Cards** - Click repo names (open in new tabs), view contributors, see detailed stats

## Repository Information

Each card shows:
- Repository name with GitHub-style icon
- Top 5 contributors with profile links
- Stars, forks, programming language (with color)
- Period-specific stats (e.g., "123 stars today")

## Technical Details

- **Stack**: Vanilla JavaScript + Tailwind CSS
- **Data**: GitHub trending pages (no API tokens needed)
- **Storage**: Chrome local storage for settings
- **Performance**: Concurrent fetching, memory caching, progressive loading
- **Error Handling**: Individual retry, timeout handling, graceful degradation

## Supported Languages

36 validated languages: C, C++, C#, Python, JavaScript, TypeScript, Rust, Go, Java, Swift, Kotlin, Dart, PHP, Ruby, etc.

Plus custom language support.
