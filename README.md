# GitHub Trending - Edge Extension

This Edge browser extension replaces your new tab page with a beautiful dashboard showing trending GitHub repositories for Python, C++, C, Rust, TypeScript, and Lua.

## Features

- Shows top trending repositories for multiple programming languages
- Clean and modern UI using Tailwind CSS
- Caches results to minimize API calls
- Updates automatically every hour
- Displays repository details including stars and descriptions

## Installation

1. Open Edge browser and navigate to `edge://extensions/`
2. Enable "Developer mode" in the left sidebar
3. Click "Load unpacked"
4. Select the directory containing this extension

## Usage

Simply open a new tab in Edge! The extension will automatically display the trending repositories for the specified programming languages.

Each repository card shows:
- Programming language with color indicator
- Repository name and link
- Description
- Star count

## Technical Details

- Uses GitHub API v3 for fetching trending repositories
- Implements caching to respect API rate limits
- Built with vanilla JavaScript and Tailwind CSS
- Uses Chrome Extension Manifest V3

## Note

You may want to create GitHub API tokens if you hit rate limits. To use a token, you would need to modify the fetch headers in `app.js` to include your token.
