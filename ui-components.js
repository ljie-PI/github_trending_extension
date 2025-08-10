// UI Components Module
// Handles creation and management of UI components

class UIComponents {
    constructor() {
        this.timeRanges = ['daily', 'weekly', 'monthly'];
        this.timeRangeLabels = {
            'daily': 'Today',
            'weekly': 'This week',
            'monthly': 'This month'
        };
    }

    // Generate CSS class name for language
    getLanguageClass(language) {
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
            
            const safeName = languageClassMap[language] || language.replace(/\\s+/g, '');
            return `language-${safeName}`;
        }
        
        // Custom language - use default class
        return 'language-custom';
    }

    // Create loading overlay
    createLoadingOverlay() {
        const loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg hidden';
        loadingOverlay.innerHTML = `
            <div class="flex flex-col items-center">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
                <span class="text-gray-600">Loading...</span>
            </div>
        `;
        return loadingOverlay;
    }

    // Create time range button group
    createTimeRangeButtons(language, currentTimeRange, onTimeRangeChange, sectionTimeRanges) {
        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'flex bg-gray-100 rounded-md border border-gray-300 overflow-hidden';

        // Add buttons
        this.timeRanges.forEach((range) => {
            const button = document.createElement('button');
            button.className = `px-3 py-1 text-sm font-medium transition-colors border-r border-gray-300 last:border-r-0 ${
                range === currentTimeRange 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-transparent text-gray-700 hover:bg-gray-200'
            }`;
            button.textContent = this.timeRangeLabels[range];
            button.dataset.range = range;
            
            // Handle click event
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
                sectionTimeRanges.set(language || 'all', range);
                onTimeRangeChange(range);
            });
            
            buttonGroup.appendChild(button);
        });

        return buttonGroup;
    }

    // Create repository card
    createRepositoryCard(repo, language) {
        const card = document.createElement('div');
        card.className = 'repo-card bg-gray-50 rounded-lg p-4 hover:shadow-md transition-shadow';

        const stars = repo.stargazers_count.toLocaleString();
        const forks = repo.forks_count.toLocaleString();
        const description = repo.description ? repo.description : 'No description available';
        
        // Generate language indicator HTML - use section language or detected repo language
        const displayLanguage = language || repo.language;
        const languageHtml = displayLanguage ? 
            `<span class="flex items-center text-gray-600 text-xs mr-4">
                <span class="language-dot ${this.getLanguageClass(displayLanguage)}"></span>
                ${displayLanguage}
            </span>` : '';

        // Generate period stars HTML - show if we have period stars or period range
        const periodStarsHtml = (repo.period_stars > 0 || repo.period_range) ? 
            `<span class="flex items-center text-yellow-600 text-sm">
                <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                </svg>
                ${repo.period_stars > 0 ? repo.period_stars.toLocaleString() : '0'} stars ${repo.period_range || 'today'}
            </span>` : '';
            
        // Debug logging for UI
        if (repo.period_stars || repo.period_range) {
            console.log(`UI rendering period stars: ${repo.period_stars} ${repo.period_range} for ${repo.full_name}`);
        }

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

        return card;
    }

    // Create language section
    createLanguageSection(language, repos, onTimeRangeChange, sectionTimeRanges) {
        const section = document.createElement('div');
        section.className = 'language-section bg-white rounded-lg shadow-lg p-6 relative';

        const header = document.createElement('div');
        header.className = 'flex items-center justify-between cursor-pointer p-2 rounded';

        const titleContainer = document.createElement('div');
        titleContainer.className = 'flex items-center justify-between w-full';

        const titleDiv = document.createElement('div');
        titleDiv.className = 'flex items-center';
        titleDiv.innerHTML = language ?
            `<span class="language-indicator ${this.getLanguageClass(language)}"></span>
            <h2 class="text-2xl font-bold text-gray-800">${language}</h2>` :
            `<h2 class="text-2xl font-bold text-gray-800">Overall Trending</h2>`;

        const navigationDiv = document.createElement('div');
        navigationDiv.className = 'flex items-center navigation-controls';

        const currentTimeRange = sectionTimeRanges.get(language || 'all') || 'daily';
        const loadingOverlay = this.createLoadingOverlay();

        // Create button group
        const buttonGroup = this.createTimeRangeButtons(language, currentTimeRange, async (newTimeRange) => {
            // Show loading overlay
            loadingOverlay.classList.remove('hidden');

            // Update content
            await onTimeRangeChange(newTimeRange);

            // Hide loading overlay and ensure section is expanded
            loadingOverlay.classList.add('hidden');
            grid.style.display = 'grid';
            navigationDiv.style.display = 'flex';
        }, sectionTimeRanges);

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
            const card = this.createRepositoryCard(repo, language);
            grid.appendChild(card);
        });

        section.appendChild(header);
        section.appendChild(grid);
        return section;
    }

    // Create error section
    createErrorSection(language, error, onRetry) {
        const section = document.createElement('div');
        section.className = 'language-section bg-white rounded-lg shadow-lg p-6 relative';

        const header = document.createElement('div');
        header.className = 'flex items-center justify-between cursor-pointer p-2 rounded';

        const titleContainer = document.createElement('div');
        titleContainer.className = 'flex items-center justify-between w-full';

        const titleDiv = document.createElement('div');
        titleDiv.className = 'flex items-center';
        titleDiv.innerHTML = language ?
            `<span class="language-indicator ${this.getLanguageClass(language)}"></span>
            <h2 class="text-2xl font-bold text-gray-800">${language}</h2>` :
            `<h2 class="text-2xl font-bold text-gray-800">Overall Trending</h2>`;

        const navigationDiv = document.createElement('div');
        navigationDiv.className = 'flex items-center navigation-controls';
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

    // Create loading placeholder section
    createLoadingSection(language) {
        const section = document.createElement('div');
        section.className = 'language-section bg-white rounded-lg shadow-lg p-6 relative';
        section.dataset.language = language || 'all';
        section.innerHTML = `
            <div class="flex items-center justify-center p-8">
                <div class="flex flex-col items-center">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
                    <span class="text-gray-600">Loading ${language || 'Overall'} Trending...</span>
                </div>
            </div>
        `;
        return section;
    }
}

// Export for global use
if (typeof window !== 'undefined') {
    window.UIComponents = UIComponents;
}