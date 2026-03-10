# Privacy Policy — RepoLens

**Last updated:** March 11, 2026

## Overview

RepoLens is a Chrome extension that scans webpages for GitHub repository links and displays their maintenance status. Your privacy matters — this extension is designed to work without collecting, storing, or transmitting any personal data.

## What data RepoLens accesses

- **GitHub repository metadata** — The extension calls the public GitHub API (`api.github.com/repos/{owner}/{repo}`) to fetch repository information such as last push date, star count, and archived status. This is public data available to anyone.

## What data is stored locally

- **API cache** — GitHub API responses are cached locally on your device using `chrome.storage.local` for 30 minutes to reduce redundant API calls. Cache is automatically cleared after expiry.
- **User preferences** — Display toggle settings (which badge/tooltip fields to show) are stored locally using `chrome.storage.sync`.
- **GitHub token** — If you choose to provide a GitHub Personal Access Token, it is stored locally in `chrome.storage.sync` and is only sent to `api.github.com` for authentication. It is never sent anywhere else.

## What data RepoLens does NOT collect

- No personal information (name, email, address)
- No browsing history or web activity
- No analytics or telemetry
- No cookies or tracking pixels
- No data is sent to any server other than `api.github.com`
- No data is sold or shared with third parties

## Third-party services

The only external service used is the **GitHub REST API** (`api.github.com`). Requests contain only the repository owner and name extracted from links on the page. GitHub's own privacy policy applies to their API: https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement

## Your control

- You can disable the extension at any time from the popup or `chrome://extensions/`
- You can remove your GitHub token at any time from the extension settings
- Uninstalling the extension removes all locally stored data

## Changes

If this policy changes, the updated version will be posted in this repository with a new date.

## Contact

For questions or concerns, open an issue: https://github.com/TobiiNT/repolens/issues
