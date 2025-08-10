// Data Fetcher Module
// Handles GitHub trending data fetching with concurrency control and caching

class DataFetcher {
    constructor(cacheManager) {
        this.cache = cacheManager;
        this.defaultTimeout = 5000; // 5 seconds
    }

    // Parse GitHub trending HTML
    parseTrendingHTML(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const articles = doc.querySelectorAll('article.Box-row');

        return Array.from(articles).map(article => {
            const titleElement = article.querySelector('h2.h3 a');
            const [owner, repo] = titleElement.textContent.trim().split('/');
            const description = article.querySelector('p.col-9')?.textContent.trim() || '';
            const starsText = article.querySelector('a[href$="/stargazers"]')?.textContent.trim() || '0';
            const stars = parseInt(starsText.replace(/,/g, '')) || 0;

            // Extract language information
            const languageElement = article.querySelector('span[itemprop="programmingLanguage"]');
            const language = languageElement?.textContent.trim() || '';

            // Extract fork count
            const forksElement = article.querySelector('a[href$="/forks"]');
            const forksText = forksElement?.textContent.trim() || '0';
            const forks = parseInt(forksText.replace(/,/g, '')) || 0;

            // Extract period stars (e.g., "123 stars today")
            // Try multiple selectors for period stars as GitHub's structure may vary
            let periodStarsElement = article.querySelector('span.d-inline-block.float-sm-right');
            if (!periodStarsElement) {
                periodStarsElement = article.querySelector('span.float-sm-right');
            }
            if (!periodStarsElement) {
                // Try more general selectors
                periodStarsElement = article.querySelector('span[class*="float"]');
            }
            if (!periodStarsElement) {
                // Find by text content as fallback
                periodStarsElement = Array.from(article.querySelectorAll('span')).find(span => {
                    const text = span.textContent.toLowerCase();
                    return text.includes('stars today') || 
                           text.includes('stars this week') || 
                           text.includes('stars this month') ||
                           text.includes('star today') ||
                           text.includes('star this week') ||
                           text.includes('star this month');
                });
            }
            
            const periodStarsText = periodStarsElement?.textContent.trim() || '';
            const periodStarsMatch = periodStarsText.match(/(\d+(?:,\d+)*)\s+stars?\s+(today|this week|this month)/i);
            const periodStars = periodStarsMatch ? parseInt(periodStarsMatch[1].replace(/,/g, '')) : 0;
            const periodRange = periodStarsMatch ? periodStarsMatch[2] : '';
            
            // Enhanced debug logging for period stars
            if (periodStarsText) {
                console.log(`Found period stars element with text: "${periodStarsText}"`);
                console.log(`Parsed period stars: ${periodStars}, range: ${periodRange}`);
            } else {
                // Debug: log available spans to help identify the correct selector
                const allSpans = Array.from(article.querySelectorAll('span')).map(s => s.textContent.trim()).filter(t => t);
                console.log(`No period stars found for ${owner}/${repo}. Available spans:`, allSpans.slice(0, 10));
            }

            // Extract repository avatar/icon
            const avatarElement = article.querySelector('img[src*="avatars"]');
            const avatar = avatarElement ? avatarElement.src : `https://github.com/${owner.trim()}.png?size=40`;

            // Extract developers/contributors (Built by section)
            const developers = [];
            const builtBySection = Array.from(article.querySelectorAll('span')).find(span => 
                span.textContent.trim().includes('Built by'));
            
            if (builtBySection) {
                const container = builtBySection.parentElement || builtBySection;
                const developerLinks = container.querySelectorAll('a[href^="/"]');
                
                for (let i = 0; i < Math.min(5, developerLinks.length); i++) {
                    const link = developerLinks[i];
                    const avatar = link.querySelector('img');
                    if (avatar && link.getAttribute('href').startsWith('/')) {
                        developers.push({
                            username: link.getAttribute('href').substring(1),
                            avatar_url: avatar.src,
                            profile_url: `https://github.com${link.getAttribute('href')}`
                        });
                    }
                }
            }

            return {
                full_name: `${owner.trim()}/${repo.trim()}`,
                description,
                stargazers_count: stars,
                html_url: `https://github.com${titleElement.getAttribute('href')}`,
                language,
                forks_count: forks,
                period_stars: periodStars,
                period_range: periodRange,
                avatar_url: avatar,
                owner: owner.trim(),
                developers: developers
            };
        });
    }

    // Fetch trending repositories for a single language/timeRange
    async fetchTrendingRepos(language, timeRange = 'daily') {
        const url = language ?
            `https://github.com/trending/${encodeURIComponent(language)}?since=${timeRange}` :
            `https://github.com/trending?since=${timeRange}`;
        
        // Create an AbortController for the timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.defaultTimeout);

        try {
            const response = await fetch(url, {
                headers: {
                    'Accept': 'text/html',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const html = await response.text();
            const repos = this.parseTrendingHTML(html);
            
            // Cache successful results
            if (repos.length > 0) {
                this.cache.set(language, timeRange, repos);
            }
            
            return repos;
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error(`Timeout fetching ${language || 'all'} trending after ${this.defaultTimeout}ms`);
            } else {
                console.error(`Error fetching ${language || 'all'} trending:`, error);
            }
            return [];
        } finally {
            clearTimeout(timeoutId);
        }
    }

    // Fetch multiple repositories with concurrency control
    async fetchMultipleConcurrent(requests, concurrencyLimit = 5) {
        const results = [];
        const executing = [];
        
        for (const request of requests) {
            const promise = this.fetchTrendingRepos(request.language, request.timeRange)
                .then(repos => ({
                    ...request,
                    repos,
                    success: repos.length > 0
                }))
                .catch(error => ({
                    ...request,
                    error,
                    success: false
                }));
            
            results.push(promise);
            
            if (results.length >= concurrencyLimit) {
                executing.push(promise);
                
                if (executing.length >= concurrencyLimit) {
                    await Promise.race(executing);
                    executing.splice(executing.findIndex(p => p === promise), 1);
                }
            }
        }
        
        return Promise.all(results);
    }

    // Fetch with retry functionality
    async fetchWithRetry(requests, concurrencyLimit = 5, retryCount = 1) {
        let results = await this.fetchMultipleConcurrent(requests, concurrencyLimit);
        
        // Find failed requests for retry
        const failedRequests = results.filter(result => !result.success).map(result => ({
            language: result.language,
            timeRange: result.timeRange
        }));
        
        // Retry failed requests if any and retryCount > 0
        if (failedRequests.length > 0 && retryCount > 0) {
            console.log(`Retrying ${failedRequests.length} failed requests...`);
            const retryResults = await this.fetchWithRetry(failedRequests, concurrencyLimit, retryCount - 1);
            
            // Replace failed results with retry results
            retryResults.forEach(retryResult => {
                const originalIndex = results.findIndex(r => 
                    r.language === retryResult.language && r.timeRange === retryResult.timeRange
                );
                if (originalIndex !== -1) {
                    results[originalIndex] = retryResult;
                }
            });
        }
        
        return results;
    }

    // Fetch with cache-first strategy
    async fetchWithCache(language, timeRange) {
        // Check cache first
        const cachedData = this.cache.getValid(language, timeRange);
        
        if (cachedData) {
            console.log(`Using cached data for ${language || 'overall'} ${timeRange}`);
            return cachedData;
        }
        
        console.log(`Fetching fresh data for ${language || 'overall'} ${timeRange}`);
        return await this.fetchTrendingRepos(language, timeRange);
    }
}

// Export for global use
if (typeof window !== 'undefined') {
    window.DataFetcher = DataFetcher;
}