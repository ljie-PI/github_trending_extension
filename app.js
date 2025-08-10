let languages = [null]; // Will be populated from settings (null = Overall Trending)
const timeRanges = ['daily', 'weekly', 'monthly'];
const timeRangeLabels = {
    'daily': 'Today',
    'weekly': 'This week',
    'monthly': 'This month'
};

// Keep track of selected time range for each section
const sectionTimeRanges = new Map();

// Memory cache for preloaded data
const trendingCache = new Map();

// Use getLanguageColor from language-settings.js
function getLanguageColor(language) {
    return window.LanguageSettings.getLanguageColor(language);
}

// Generate CSS class name for language
function getLanguageClass(language) {
    if (!language) return 'language-custom';
    
    // Check if it's a predefined language
    const predefinedLanguages = window.LanguageSettings.AVAILABLE_LANGUAGES;
    if (predefinedLanguages && predefinedLanguages.includes(language)) {
        // Map languages with special characters to CSS-safe names
        const languageClassMap = {
            'C#': 'CSharp',
            'C++': 'CPlusPlus',
            'F#': 'FSharp',
            'Objective-C': 'ObjectiveC'
        };
        
        const safeName = languageClassMap[language] || language.replace(/\s+/g, '');
        return `language-${safeName}`;
    }
    
    // Custom language - use default class
    return 'language-custom';
}

function parseTrendingHTML(html) {
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
        const periodStarsElement = article.querySelector('span.d-inline-block.float-sm-right');
        const periodStarsText = periodStarsElement?.textContent.trim() || '';
        const periodStarsMatch = periodStarsText.match(/(\d+(?:,\d+)*)\s+stars?\s+(today|this week|this month)/);
        const periodStars = periodStarsMatch ? parseInt(periodStarsMatch[1].replace(/,/g, '')) : 0;
        const periodRange = periodStarsMatch ? periodStarsMatch[2] : '';

        // Extract repository avatar/icon
        const avatarElement = article.querySelector('img[src*="avatars"]');
        const avatar = avatarElement ? avatarElement.src : `https://github.com/${owner.trim()}.png?size=40`;

        // Extract developers/contributors (Built by section)
        const developers = [];
        // Find "Built by" text in spans
        const builtBySection = Array.from(article.querySelectorAll('span')).find(span => 
            span.textContent.trim().includes('Built by'));
        
        if (builtBySection) {
            // Look for developer avatars in the same container or parent
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

async function fetchTrendingRepos(language, timeRange = 'daily') {
    const url = language ?
        `https://github.com/trending/${encodeURIComponent(language)}?since=${timeRange}` :
        `https://github.com/trending?since=${timeRange}`;
    
    // Create an AbortController for the timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 seconds timeout

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
        const repos = parseTrendingHTML(html);
        return repos;
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error(`Timeout fetching ${language || 'all'} trending after 5 seconds`);
        } else {
            console.error(`Error fetching ${language || 'all'} trending:`, error);
        }
        return [];
    } finally {
        clearTimeout(timeoutId);
    }
}

// Concurrent fetching function with limit
async function fetchMultipleTrendingConcurrent(requests, concurrencyLimit = 5) {
    const results = [];
    const executing = [];
    
    for (const request of requests) {
        const promise = fetchTrendingRepos(request.language, request.timeRange)
            .then(repos => ({
                ...request,
                repos,
                success: true
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

// Concurrent fetching with retry functionality
async function fetchMultipleTrendingWithRetry(requests, concurrencyLimit = 5, retryCount = 1) {
    let results = await fetchMultipleTrendingConcurrent(requests, concurrencyLimit);
    
    // Find failed requests for retry
    const failedRequests = results.filter(result => !result.success).map(result => ({
        language: result.language,
        timeRange: result.timeRange
    }));
    
    // Retry failed requests if any and retryCount > 0
    if (failedRequests.length > 0 && retryCount > 0) {
        console.log(`Retrying ${failedRequests.length} failed requests...`);
        const retryResults = await fetchMultipleTrendingWithRetry(failedRequests, concurrencyLimit, retryCount - 1);
        
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

// Generate cache key
function getCacheKey(language, timeRange) {
    return `${language || 'all'}-${timeRange}`;
}

// Get cached data
function getCachedData(language, timeRange) {
    return trendingCache.get(getCacheKey(language, timeRange));
}

// Set cached data
function setCachedData(language, timeRange, data) {
    trendingCache.set(getCacheKey(language, timeRange), {
        data,
        timestamp: Date.now()
    });
}

// Check if cached data is valid (within 10 minutes)
function isCacheValid(cacheEntry) {
    return cacheEntry && (Date.now() - cacheEntry.timestamp) < 10 * 60 * 1000;
}


function createLanguageSection(language, repos, onTimeRangeChange) {
    const section = document.createElement('div');
    section.className = 'language-section bg-white rounded-lg shadow-lg p-6 relative';

    const header = document.createElement('div');
    header.className = 'flex items-center justify-between cursor-pointer p-2 rounded';

    const titleContainer = document.createElement('div');
    titleContainer.className = 'flex items-center justify-between w-full';

    const titleDiv = document.createElement('div');
    titleDiv.className = 'flex items-center';
    titleDiv.innerHTML = language ?
        `<span class="language-indicator ${getLanguageClass(language)}"></span>
        <h2 class="text-2xl font-bold text-gray-800">${language}</h2>` :
        `<h2 class="text-2xl font-bold text-gray-800">Overall Trending</h2>`;

    const navigationDiv = document.createElement('div');
    navigationDiv.className = 'flex items-center navigation-controls';

    // Create button group
    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'flex bg-gray-100 rounded-md border border-gray-300 overflow-hidden';

    const currentTimeRange = sectionTimeRanges.get(language || 'all') || 'daily';

    // Add buttons
    timeRanges.forEach((range, index) => {
        const button = document.createElement('button');
        button.className = `px-3 py-1 text-sm font-medium transition-colors border-r border-gray-300 last:border-r-0 ${
            range === currentTimeRange 
                ? 'bg-blue-600 text-white' 
                : 'bg-transparent text-gray-700 hover:bg-gray-200'
        }`;
        button.textContent = timeRangeLabels[range];
        button.dataset.range = range;
        
        // Prevent click event from bubbling up to flex container
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Update button styles
            buttonGroup.querySelectorAll('button').forEach(btn => {
                btn.className = `px-3 py-1 text-sm font-medium transition-colors border-r border-gray-300 last:border-r-0 ${
                    btn.dataset.range === range 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-transparent text-gray-700 hover:bg-gray-200'
                }`;
            });
            
            // Trigger time range change
            const newTimeRange = range;
            sectionTimeRanges.set(language || 'all', newTimeRange);

            // Show loading overlay
            loadingOverlay.classList.remove('hidden');

            // Update content
            onTimeRangeChange(newTimeRange).then(() => {
                // Hide loading overlay and ensure section is expanded
                loadingOverlay.classList.add('hidden');
                grid.style.display = 'grid';
                navigationDiv.style.display = 'flex';
            });
        });
        
        buttonGroup.appendChild(button);
    });

    // Create loading overlay
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg hidden';
    loadingOverlay.innerHTML = `
        <div class="flex flex-col items-center">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
            <span class="text-gray-600">Loading...</span>
        </div>
    `;

    // Initially hide navigation for collapsed sections
    navigationDiv.style.display = language ? 'none' : 'flex';

    navigationDiv.appendChild(buttonGroup);

    titleContainer.appendChild(titleDiv);
    titleContainer.appendChild(navigationDiv);
    header.appendChild(titleContainer);

    // Add loading overlay to section
    section.appendChild(loadingOverlay);

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-1 md:grid-cols-2 gap-6 mt-6';
    grid.style.display = language ? 'none' : 'grid'; // Only show content for Overall Trending by default

    header.addEventListener('click', () => {
        const isCollapsed = grid.style.display === 'none';
        grid.style.display = isCollapsed ? 'grid' : 'none';
        navigationDiv.style.display = isCollapsed ? 'flex' : 'none';
    });

    repos.forEach(repo => {
        const card = document.createElement('div');
        card.className = 'repo-card bg-gray-50 rounded-lg p-4 hover:shadow-md transition-shadow';

        const stars = repo.stargazers_count.toLocaleString();
        const forks = repo.forks_count.toLocaleString();
        const description = repo.description ? repo.description : 'No description available';
        
        // Generate language indicator HTML - use section language or detected repo language
        const displayLanguage = language || repo.language;
        const languageHtml = displayLanguage ? 
            `<span class="flex items-center text-gray-600 text-xs mr-4">
                <span class="language-dot ${getLanguageClass(displayLanguage)}"></span>
                ${displayLanguage}
            </span>` : '';

        // Generate period stars HTML
        const periodStarsHtml = repo.period_stars > 0 ? 
            `<span class="flex items-center text-yellow-600 text-sm">
                <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                </svg>
                ${repo.period_stars.toLocaleString()} stars ${repo.period_range}
            </span>` : '';

        // Generate developers HTML
        const developersHtml = repo.developers && repo.developers.length > 0 ? 
            `<div class="flex items-center text-xs text-gray-500 mt-2">
                <span class="mr-2">Built by</span>
                <div class="flex items-center space-x-1">
                    ${repo.developers.map(dev => 
                        `<a href="${dev.profile_url}" target="_blank" title="@${dev.username}" class="hover:opacity-80">
                            <img src="${dev.avatar_url}" alt="@${dev.username}" class="w-5 h-5 rounded-full">
                        </a>`
                    ).join('')}
                </div>
            </div>` : '';

        card.innerHTML = `
            <div class="flex items-start mb-3">
                <svg class="w-4 h-4 mr-3 mt-2 flex-shrink-0 text-gray-600" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 1 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 0 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 0 1 1-1h8zM5 12.25v3.25a.25.25 0 0 0 .4.2l1.45-1.087a.25.25 0 0 1 .3 0L8.6 15.7a.25.25 0 0 0 .4-.2v-3.25a.25.25 0 0 0-.25-.25h-3.5a.25.25 0 0 0-.25.25z"/>
                </svg>
                <div class="flex-1">
                    <a href="${repo.html_url}" target="_blank" class="text-lg font-medium text-blue-600 hover:text-blue-800">
                        ${repo.full_name}
                    </a>
                    ${developersHtml}
                </div>
            </div>
            <p class="text-gray-600 text-sm mb-3 line-clamp-2">${description}</p>
            <div class="flex flex-wrap items-center gap-4 text-xs mb-2">
                ${languageHtml}
                <span class="flex items-center text-gray-600">
                    <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 16 16">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z"/>
                    </svg>
                    ${stars}
                </span>
                <span class="flex items-center text-gray-600">
                    <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M5 3.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 2.122a2.25 2.25 0 10-1.5 0v.878A2.25 2.25 0 005.75 8.5h1.5v2.128a2.251 2.251 0 101.5 0V8.5h1.5a2.25 2.25 0 002.25-2.25v-.878a2.25 2.25 0 10-1.5 0v.878a.75.75 0 01-.75.75h-4.5A.75.75 0 015 6.25v-.878zm3.75 7.378a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm3-8.75a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"/>
                    </svg>
                    ${forks}
                </span>
            </div>
            ${periodStarsHtml ? `<div class="mt-2">${periodStarsHtml}</div>` : ''}
        `;

        grid.appendChild(card);
    });

    section.appendChild(header);
    section.appendChild(grid);
    return section;
}

function createErrorSection(language, error, onRetry) {
    const section = document.createElement('div');
    section.className = 'language-section bg-white rounded-lg shadow-lg p-6 relative';

    const header = document.createElement('div');
    header.className = 'flex items-center justify-between cursor-pointer p-2 rounded';

    const titleContainer = document.createElement('div');
    titleContainer.className = 'flex items-center justify-between w-full';

    const titleDiv = document.createElement('div');
    titleDiv.className = 'flex items-center';
    titleDiv.innerHTML = language ?
        `<span class="language-indicator ${getLanguageClass(language)}"></span>
        <h2 class="text-2xl font-bold text-gray-800">${language}</h2>` :
        `<h2 class="text-2xl font-bold text-gray-800">Overall Trending</h2>`;

    const navigationDiv = document.createElement('div');
    navigationDiv.className = 'flex items-center navigation-controls';

    // Initially show navigation for error sections
    navigationDiv.style.display = 'flex';

    titleContainer.appendChild(titleDiv);
    titleContainer.appendChild(navigationDiv);
    header.appendChild(titleContainer);

    // Error content
    const errorContent = document.createElement('div');
    errorContent.className = 'mt-6 text-center py-8';
    
    const isTimeout = error.name === 'AbortError' || error.message.includes('timeout') || error.message.includes('Timeout');
    const errorMessage = isTimeout ? 'Request timed out' : 'Failed to load trending repositories';
    
    errorContent.innerHTML = `
        <div class="text-gray-500 mb-4">
            <svg class="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 18.5c-.77.833.192 2.5 1.732 2.5z"></path>
            </svg>
            <p class="text-lg font-medium text-gray-700">${errorMessage}</p>
            <p class="text-sm text-gray-500 mt-1">${isTimeout ? 'The request took too long to complete' : 'Please check your connection and try again'}</p>
        </div>
        <button class="retry-btn px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
            Retry
        </button>
    `;

    // Add retry functionality
    const retryBtn = errorContent.querySelector('.retry-btn');
    retryBtn.addEventListener('click', () => {
        // Show loading state
        errorContent.innerHTML = `
            <div class="text-center py-8">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                <span class="text-gray-600">Loading...</span>
            </div>
        `;
        
        // Trigger retry
        onRetry();
    });

    section.appendChild(header);
    section.appendChild(errorContent);
    return section;
}

// Background preloading function
async function preloadWeeklyMonthlyData() {
    console.log('Starting background preload of weekly and monthly data...');
    
    // Generate requests for weekly and monthly data for all languages
    const preloadRequests = [];
    languages.forEach(lang => {
        preloadRequests.push(
            { language: lang, timeRange: 'weekly' },
            { language: lang, timeRange: 'monthly' }
        );
    });
    
    try {
        const results = await fetchMultipleTrendingConcurrent(preloadRequests, 5);
        
        // Store successful results in cache
        results.forEach(result => {
            if (result.success && result.repos && result.repos.length > 0) {
                setCachedData(result.language, result.timeRange, result.repos);
                console.log(`Preloaded ${result.language || 'overall'} ${result.timeRange} data: ${result.repos.length} repos`);
            }
        });
        
        console.log('Background preload completed');
    } catch (error) {
        console.error('Error during background preload:', error);
    }
}

async function displayTrendingRepos() {
    const container = document.getElementById('trending-container');
    container.innerHTML = ''; // Clear existing content

    try {
        // Initialize time ranges and create placeholder sections
        languages.forEach(lang => {
            const key = lang || 'all';
            if (!sectionTimeRanges.has(key)) {
                sectionTimeRanges.set(key, 'daily');
            }

            // Create placeholder section with loading state
            const section = document.createElement('div');
            section.className = 'language-section bg-white rounded-lg shadow-lg p-6 relative';
            section.dataset.language = lang || 'all';
            section.innerHTML = `
                <div class="flex items-center justify-center p-8">
                    <div class="flex flex-col items-center">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
                        <span class="text-gray-600">Loading ${lang || 'Overall'} Trending...</span>
                    </div>
                </div>
            `;
            container.appendChild(section);
        });

        // Prepare daily requests for concurrent fetching
        const dailyRequests = languages.map(lang => ({
            language: lang,
            timeRange: 'daily'
        }));

        // Track completed loads for background preloading
        let completedLoads = 0;
        const totalLanguages = languages.length;

        // Fetch all daily data with concurrency limit and process individually
        const fetchPromises = dailyRequests.map(async (request) => {
            try {
                const repos = await fetchTrendingRepos(request.language, request.timeRange);
                const result = {
                    ...request,
                    repos,
                    success: repos.length > 0
                };
                
                // Process result immediately when this language completes
                processLanguageResult(result, container);
                
                // Track completion for background preloading
                completedLoads++;
                if (completedLoads === totalLanguages) {
                    setTimeout(() => preloadWeeklyMonthlyData(), 1000);
                }
                
                return result;
            } catch (error) {
                const result = {
                    ...request,
                    error,
                    success: false
                };
                
                // Process error result immediately
                processLanguageResult(result, container);
                
                // Track completion for background preloading
                completedLoads++;
                if (completedLoads === totalLanguages) {
                    setTimeout(() => preloadWeeklyMonthlyData(), 1000);
                }
                
                return result;
            }
        });

        // Wait for all to complete (for cleanup purposes)
        await Promise.all(fetchPromises);

        // Use the shared processLanguageResult function (defined later in the file)
    } catch (error) {
        console.error('Error fetching trending repositories:', error);
    }
}


// Settings functionality
let currentSelectedLanguages = [];

// Initialize settings modal
function initializeSettings() {
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettings = document.getElementById('close-settings');
    const cancelSettings = document.getElementById('cancel-settings');
    const saveSettings = document.getElementById('save-settings');
    const resetSettings = document.getElementById('reset-settings');
    const languageCheckboxes = document.getElementById('language-checkboxes');
    const customLanguageInput = document.getElementById('custom-language-input');
    const addCustomLanguageBtn = document.getElementById('add-custom-language');

    // Populate language checkboxes
    async function populateLanguageCheckboxes(selectedLanguages) {
        languageCheckboxes.innerHTML = '';
        const availableLanguages = await window.LanguageSettings.getAvailableLanguages();
        const customLanguages = await window.LanguageSettings.loadCustomLanguages();
        
        availableLanguages.forEach(language => {
            const checkbox = document.createElement('div');
            checkbox.className = 'flex items-center justify-between';
            
            const isChecked = selectedLanguages.includes(language);
            const isCustom = customLanguages.includes(language);
            
            checkbox.innerHTML = `
                <div class="flex items-center">
                    <input type="checkbox" id="lang-${language}" class="mr-2" ${isChecked ? 'checked' : ''}>
                    <label for="lang-${language}" class="flex items-center cursor-pointer text-sm">
                        <span class="language-dot mr-2 ${getLanguageClass(language)}"></span>
                        ${language}
                        ${isCustom ? '<span class="ml-1 text-xs text-blue-600">(custom)</span>' : ''}
                    </label>
                </div>
                ${isCustom ? `
                    <button class="remove-custom-lang text-red-500 hover:text-red-700 text-xs ml-2" 
                            data-language="${language}" title="Remove custom language">
                        ✕
                    </button>
                ` : ''}
            `;
            languageCheckboxes.appendChild(checkbox);
        });
        
        // Add event listeners for remove buttons
        languageCheckboxes.querySelectorAll('.remove-custom-lang').forEach(button => {
            button.addEventListener('click', async (e) => {
                const language = e.target.dataset.language;
                if (confirm(`Remove custom language "${language}"?`)) {
                    await window.LanguageSettings.removeCustomLanguage(language);
                    // Refresh the checkbox list
                    const currentSelected = getCurrentSelectedLanguages();
                    await populateLanguageCheckboxes(currentSelected);
                }
            });
        });
    }
    
    // Get currently selected languages from checkboxes
    function getCurrentSelectedLanguages() {
        const checkboxes = languageCheckboxes.querySelectorAll('input[type="checkbox"]');
        const selected = [];
        checkboxes.forEach(checkbox => {
            if (checkbox.checked) {
                const language = checkbox.id.replace('lang-', '');
                selected.push(language);
            }
        });
        return selected;
    }

    // Add custom language functionality
    async function addCustomLanguage() {
        const languageName = customLanguageInput.value.trim();
        if (!languageName) {
            alert('Please enter a language name');
            return;
        }
        
        try {
            await window.LanguageSettings.addCustomLanguage(languageName);
            customLanguageInput.value = '';
            
            // Refresh the checkbox list
            const currentSelected = getCurrentSelectedLanguages();
            currentSelected.push(languageName); // Auto-select the new language
            await populateLanguageCheckboxes(currentSelected);
            
            alert(`Custom language "${languageName}" added successfully!`);
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    }
    
    addCustomLanguageBtn.addEventListener('click', addCustomLanguage);
    
    // Allow Enter key to add custom language
    customLanguageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addCustomLanguage();
        }
    });

    // Open settings modal
    settingsBtn.addEventListener('click', async () => {
        currentSelectedLanguages = await window.LanguageSettings.loadSelectedLanguages();
        await populateLanguageCheckboxes(currentSelectedLanguages);
        settingsModal.classList.remove('hidden');
    });

    // Close settings modal
    function closeModal() {
        settingsModal.classList.add('hidden');
    }

    closeSettings.addEventListener('click', closeModal);
    cancelSettings.addEventListener('click', closeModal);

    // Close modal when clicking outside
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            closeModal();
        }
    });

    // Reset to default settings
    resetSettings.addEventListener('click', async () => {
        const defaultLanguages = window.LanguageSettings.getDefaultLanguages();
        await populateLanguageCheckboxes(defaultLanguages);
    });

    // Save settings
    saveSettings.addEventListener('click', async () => {
        const selectedLanguages = getCurrentSelectedLanguages();
        const oldLanguages = languages.slice(1); // Remove 'null' (Overall Trending)

        // Save to storage
        await window.LanguageSettings.saveSelectedLanguages(selectedLanguages);
        
        // Update current languages
        await loadLanguageSettings();
        closeModal();
        
        // Find differences
        const newLanguages = selectedLanguages.filter(lang => !oldLanguages.includes(lang));
        const removedLanguages = oldLanguages.filter(lang => !selectedLanguages.includes(lang));
        
        // Handle changes efficiently
        if (newLanguages.length > 0 || removedLanguages.length > 0) {
            await updateLanguageSections(newLanguages, removedLanguages);
        }
    });
}

// Efficiently update language sections without full reload
async function updateLanguageSections(newLanguages, removedLanguages) {
    const container = document.getElementById('trending-container');
    
    // Remove sections for languages that are no longer selected
    removedLanguages.forEach(lang => {
        const section = container.querySelector(`[data-language="${lang || 'all'}"]`);
        if (section) {
            section.remove();
        }
    });
    
    // Add sections for new languages
    if (newLanguages.length > 0) {
        // Create placeholder sections for new languages
        newLanguages.forEach(lang => {
            const key = lang || 'all';
            if (!sectionTimeRanges.has(key)) {
                sectionTimeRanges.set(key, 'daily');
            }

            // Create placeholder section with loading state
            const section = document.createElement('div');
            section.className = 'language-section bg-white rounded-lg shadow-lg p-6 relative';
            section.dataset.language = lang || 'all';
            section.innerHTML = `
                <div class="flex items-center justify-center p-8">
                    <div class="flex flex-col items-center">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
                        <span class="text-gray-600">Loading ${lang || 'Overall'} Trending...</span>
                    </div>
                </div>
            `;
            container.appendChild(section);
        });

        // Load data for new languages only
        const newLanguagePromises = newLanguages.map(async (lang) => {
            try {
                const repos = await fetchTrendingRepos(lang, 'daily');
                const result = {
                    language: lang,
                    timeRange: 'daily',
                    repos,
                    success: repos.length > 0
                };
                
                // Process result immediately
                processLanguageResult(result, container);
                
                return result;
            } catch (error) {
                const result = {
                    language: lang,
                    timeRange: 'daily',
                    error,
                    success: false
                };
                
                // Process error result immediately
                processLanguageResult(result, container);
                
                return result;
            }
        });

        // Wait for new languages to load
        await Promise.all(newLanguagePromises);
    }
}

// Helper function to process individual language results (shared with displayTrendingRepos)
function processLanguageResult(result, container) {
    const lang = result.language;
    
    // Helper function for updating sections
    const createUpdateFunction = (language) => {
        return async (newTimeRange) => {
            try {
                // Check cache first
                const cachedData = getCachedData(language, newTimeRange);
                let newRepos;
                
                if (cachedData && isCacheValid(cachedData)) {
                    console.log(`Using cached data for ${language || 'overall'} ${newTimeRange}`);
                    newRepos = cachedData.data;
                } else {
                    console.log(`Fetching fresh data for ${language || 'overall'} ${newTimeRange}`);
                    newRepos = await fetchTrendingRepos(language, newTimeRange);
                    if (newRepos.length > 0) {
                        setCachedData(language, newTimeRange, newRepos);
                    }
                }
                
                const oldSection = container.querySelector(`[data-language="${language || 'all'}"]`);
                const newSection = createLanguageSection(language, newRepos, createUpdateFunction(language));
                newSection.dataset.language = language || 'all';
                // Ensure the grid and navigation are visible in the new section
                const grid = newSection.querySelector('.grid');
                const nav = newSection.querySelector('.navigation-controls');
                if (grid) grid.style.display = 'grid';
                if (nav) nav.style.display = 'flex';
                if (oldSection) {
                    container.replaceChild(newSection, oldSection);
                }
            } catch (error) {
                console.error(`Error updating ${language || 'overall'} section:`, error);
                const oldSection = container.querySelector(`[data-language="${language || 'all'}"]`);
                if (oldSection) {
                    const errorSection = createErrorSection(language, error, () => createUpdateFunction(language)(newTimeRange));
                    errorSection.dataset.language = language || 'all';
                    container.replaceChild(errorSection, oldSection);
                }
            }
        };
    };
    
    // Helper function for single language retry
    const retrySingleLanguage = async (language) => {
        // Show loading state
        const oldSection = container.querySelector(`[data-language="${language || 'all'}"]`);
        if (oldSection) {
            oldSection.innerHTML = `
                <div class="flex items-center justify-center p-8">
                    <div class="flex flex-col items-center">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
                        <span class="text-gray-600">Loading ${language || 'Overall'} Trending...</span>
                    </div>
                </div>
            `;
        }
        
        // Fetch data for this language
        try {
            const repos = await fetchTrendingRepos(language, 'daily');
            if (repos.length > 0) {
                setCachedData(language, 'daily', repos);
                const section = createLanguageSection(language, repos, createUpdateFunction(language));
                section.dataset.language = language || 'all';
                if (oldSection) {
                    container.replaceChild(section, oldSection);
                }
            } else {
                throw new Error('No repositories found');
            }
        } catch (error) {
            const errorSection = createErrorSection(language, error, () => retrySingleLanguage(language));
            errorSection.dataset.language = language || 'all';
            if (oldSection) {
                container.replaceChild(errorSection, oldSection);
            }
        }
    };
    
    if (result.success && result.repos && result.repos.length > 0) {
        // Cache the daily data immediately
        setCachedData(lang, 'daily', result.repos);
        
        // Create successful section with data
        const section = createLanguageSection(lang, result.repos, createUpdateFunction(lang));
        section.dataset.language = lang || 'all';
        const oldSection = container.querySelector(`[data-language="${lang || 'all'}"]`);
        if (oldSection) {
            container.replaceChild(section, oldSection);
        }
    } else {
        // Show error section for failed or empty results
        const error = result.error || new Error('No repositories found');
        const errorSection = createErrorSection(lang, error, () => retrySingleLanguage(lang));
        errorSection.dataset.language = lang || 'all';
        const oldSection = container.querySelector(`[data-language="${lang || 'all'}"]`);
        if (oldSection) {
            container.replaceChild(errorSection, oldSection);
        }
    }
}

// Load language settings and update languages array
async function loadLanguageSettings() {
    try {
        const selectedLanguages = await window.LanguageSettings.loadSelectedLanguages();
        // Always include null (Overall Trending) first, then selected languages
        languages = [null, ...selectedLanguages];
    } catch (error) {
        console.error('Error loading language settings:', error);
        // Fallback to default languages
        languages = [null, ...window.LanguageSettings.getDefaultLanguages()];
    }
}

// Initialize everything
async function initialize() {
    // Load settings first
    await loadLanguageSettings();
    
    // Initialize settings modal
    initializeSettings();
    
    // Initial load
    displayTrendingRepos();
}

// Start the application
initialize();
