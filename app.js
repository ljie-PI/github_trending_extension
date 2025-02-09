const languages = [null, 'Python', 'TypeScript', 'Rust', 'Lua', 'C', 'C++'];
const CACHE_DURATION = 60 * 60 * 1000;
//const CACHE_DURATION = 0;
const timeRanges = ['daily', 'weekly', 'monthly'];
const timeRangeLabels = {
    'daily': 'Today',
    'weekly': 'This week',
    'monthly': 'This month'
};

// Keep track of selected time range for each section
const sectionTimeRanges = new Map();

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

        return {
            full_name: `${owner.trim()}/${repo.trim()}`,
            description,
            stargazers_count: stars,
            html_url: `https://github.com${titleElement.getAttribute('href')}`
        };
    });
}

async function fetchTrendingRepos(language, timeRange = 'daily') {
    const cacheKey = `trending-${language || 'all'}-${timeRange}`;
    const cachedData = await getCachedData(cacheKey);

    if (cachedData) {
        return cachedData;
    }

    const url = language ?
        `https://github.com/trending/${encodeURIComponent(language)}?since=${timeRange}` :
        `https://github.com/trending?since=${timeRange}`;
    // Create an AbortController for the timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 seconds timeout

    try {

        const response = await fetch(
            url,
            {
                headers: {
                    'Accept': 'text/html',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                signal: controller.signal
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const html = await response.text();
        const repos = parseTrendingHTML(html);
        await cacheData(cacheKey, repos);
        return repos;
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error(`Timeout fetching ${language || 'all'} trending after 5 seconds`);
        } else {
            console.error(`Error fetching ${language || 'all'} trending:`, error);
        }
        return [];
    } finally {
        clearTimeout(timeoutId); // Clear timeout on error
    }
}

async function getCachedData(key) {
    return new Promise(resolve => {
        chrome.storage.local.get(key, result => {
            if (result[key] && (Date.now() - result[key].timestamp) < CACHE_DURATION) {
                resolve(result[key].data);
            } else {
                resolve(null);
            }
        });
    });
}

async function cacheData(key, data) {
    return new Promise(resolve => {
        chrome.storage.local.set({
            [key]: {
                data: data,
                timestamp: Date.now()
            }
        }, resolve);
    });
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
        `<span class="language-indicator language-${language}"></span>
        <h2 class="text-2xl font-bold">${language}</h2>` :
        `<h2 class="text-2xl font-bold">Overall Trending</h2>`;

    const navigationDiv = document.createElement('div');
    navigationDiv.className = 'flex items-center navigation-controls';

    // Create select dropdown
    const timeRangeSelect = document.createElement('select');
    timeRangeSelect.className = 'text-gray-700 font-medium text-lg bg-transparent border border-gray-300 rounded-md px-3 py-1 cursor-pointer hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500';

    // Add options
    timeRanges.forEach(range => {
        const option = document.createElement('option');
        option.value = range;
        option.textContent = timeRangeLabels[range];
        option.selected = range === sectionTimeRanges.get(language || 'all');
        timeRangeSelect.appendChild(option);
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

    navigationDiv.appendChild(timeRangeSelect);

    // Create popup container
    let popupWindow = null;

    // Handle popup window close
    window.addEventListener('beforeunload', () => {
        if (popupWindow && !popupWindow.closed) {
            popupWindow.close();
        }
    });

    const closePopup = () => {
        if (popupWindow && !popupWindow.closed) {
            popupWindow.close();
        }
    };

    // Handle time range change
    timeRangeSelect.addEventListener('change', async (e) => {
        e.stopPropagation(); // Prevent section collapse
        const newTimeRange = e.target.value;
        sectionTimeRanges.set(language || 'all', newTimeRange);

        // Show loading overlay
        loadingOverlay.classList.remove('hidden');

        // Update content
        await onTimeRangeChange(newTimeRange);

        // Hide loading overlay and ensure section is expanded
        loadingOverlay.classList.add('hidden');
        grid.style.display = 'grid';
        navigationDiv.style.display = 'flex';
    });

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
        const description = repo.description ? repo.description : 'No description available';

        card.innerHTML = `
            <a href="${repo.html_url}" target="_blank" class="text-lg font-medium text-blue-600 hover:text-blue-800 block mb-2">
                ${repo.full_name}
            </a>
            <p class="text-gray-600 text-sm mb-3 line-clamp-2">${description}</p>
            <div class="flex items-center text-gray-500 text-sm">
                <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                </svg>
                ${stars} stars
            </div>
        `;

        // Add popup functionality
        const titleElement = card.querySelector('a');
        titleElement.addEventListener('click', (e) => {
            e.preventDefault();
            const repoUrl = titleElement.getAttribute('href');

            // Close existing popup if open
            if (popupWindow && !popupWindow.closed) {
                popupWindow.close();
            }

            // Open new popup window
            const width = Math.min(1200, window.screen.width * 0.8);
            const height = Math.min(800, window.screen.height * 0.8);
            const left = (window.screen.width - width) / 2;
            const top = (window.screen.height - height) / 2;

            popupWindow = window.open(
                repoUrl,
                'github-repo',
                `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
            );
        });

        grid.appendChild(card);
    });

    section.appendChild(header);
    section.appendChild(grid);
    return section;
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

            // Start fetching data for this section
            fetchTrendingRepos(lang, sectionTimeRanges.get(key))
                .then(repos => {
                    if (repos.length > 0) {
                        const updateSection = async (newTimeRange) => {
                            try {
                                const newRepos = await fetchTrendingRepos(lang, newTimeRange);
                                const oldSection = container.querySelector(`[data-language="${lang || 'all'}"]`);
                                const newSection = createLanguageSection(lang, newRepos, updateSection);
                                newSection.dataset.language = lang || 'all';
                                // Ensure the grid and navigation are visible in the new section
                                const grid = newSection.querySelector('.grid');
                                const nav = newSection.querySelector('.navigation-controls');
                                if (grid) grid.style.display = 'grid';
                                if (nav) nav.style.display = 'flex';
                                if (oldSection) {
                                    container.replaceChild(newSection, oldSection);
                                }
                            } catch (error) {
                                console.error(`Error updating ${lang} section:`, error);
                            }
                        };

                        const section = createLanguageSection(lang, repos, updateSection);
                        section.dataset.language = lang || 'all';
                        const oldSection = container.querySelector(`[data-language="${lang || 'all'}"]`);
                        if (oldSection) {
                            container.replaceChild(section, oldSection);
                        }
                    } else {
                        // Remove the section if no repos found
                        const oldSection = container.querySelector(`[data-language="${lang || 'all'}"]`);
                        if (oldSection) {
                            oldSection.remove();
                        }
                    }
                })
                .catch(error => {
                    console.error(`Error fetching ${lang} trending:`, error);
                    // Remove the section on error
                    const oldSection = container.querySelector(`[data-language="${lang || 'all'}"]`);
                    if (oldSection) {
                        oldSection.remove();
                    }
                });
        });
    } catch (error) {
        console.error('Error fetching trending repositories:', error);
    }
}

// Background cache refresh function
async function refreshCache() {
    try {
        // Refresh cache for each language and time range combination
        for (const lang of languages) {
            for (const timeRange of timeRanges) {
                const cacheKey = `trending-${lang || 'all'}-${timeRange}`;
                try {
                    const url = lang ?
                        `https://github.com/trending/${encodeURIComponent(lang)}?since=${timeRange}` :
                        `https://github.com/trending?since=${timeRange}`;

                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 5000);

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
                        await cacheData(cacheKey, repos);
                        console.log(`Cache refreshed for ${lang || 'all'} - ${timeRange}`);
                    } catch (error) {
                        if (error.name === 'AbortError') {
                            console.error(`Timeout refreshing cache for ${lang || 'all'} - ${timeRange}`);
                        } else {
                            console.error(`Error refreshing cache for ${lang || 'all'} - ${timeRange}:`, error);
                        }
                    } finally {
                        clearTimeout(timeoutId);
                    }

                    // Add a small delay between requests to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    console.error(`Failed to refresh cache for ${lang || 'all'} - ${timeRange}:`, error);
                }
            }
        }
    } catch (error) {
        console.error('Error in cache refresh job:', error);
    }
}

// Initial load
displayTrendingRepos();

// Start background cache refresh
setInterval(refreshCache, CACHE_DURATION);
// refreshCache(); // Initial cache population
