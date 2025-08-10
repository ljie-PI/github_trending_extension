// Main Application Module
// Coordinates all modules and manages application state

class TrendingApp {
    constructor() {
        // Initialize modules
        this.cache = new CacheManager();
        this.dataFetcher = new DataFetcher(this.cache);
        this.uiComponents = new UIComponents();
        this.settingsManager = new SettingsManager(this.uiComponents);
        
        // Application state
        this.languages = [null]; // Will be populated from settings (null = Overall Trending)
        this.sectionTimeRanges = new Map();
        
        // Bind methods
        this.processLanguageResult = this.processLanguageResult.bind(this);
        
        // Set up settings save callback
        this.settingsManager.setSaveCallback(this.handleSettingsSave.bind(this));
        
        // Initialize the application
        this.initialize();
    }

    // Load language settings and update languages array
    async loadLanguageSettings() {
        try {
            const selectedLanguages = await window.LanguageSettings.loadSelectedLanguages();
            // Always include null (Overall Trending) first, then selected languages
            this.languages = [null, ...selectedLanguages];
        } catch (error) {
            console.error('Error loading language settings:', error);
            // Fallback to default languages
            this.languages = [null, ...window.LanguageSettings.getDefaultLanguages()];
        }
    }

    // Handle settings save with smart updates
    async handleSettingsSave(selectedLanguages) {
        const oldLanguages = this.languages.slice(1); // Remove 'null' (Overall Trending)

        // Save to storage
        await window.LanguageSettings.saveSelectedLanguages(selectedLanguages);
        
        // Update current languages
        await this.loadLanguageSettings();
        
        // Find differences
        const newLanguages = selectedLanguages.filter(lang => !oldLanguages.includes(lang));
        const removedLanguages = oldLanguages.filter(lang => !selectedLanguages.includes(lang));
        
        // Handle changes efficiently
        if (newLanguages.length > 0 || removedLanguages.length > 0) {
            await this.updateLanguageSections(newLanguages, removedLanguages);
        }
    }

    // Efficiently update language sections without full reload
    async updateLanguageSections(newLanguages, removedLanguages) {
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
                if (!this.sectionTimeRanges.has(key)) {
                    this.sectionTimeRanges.set(key, 'daily');
                }

                const section = this.uiComponents.createLoadingSection(lang);
                container.appendChild(section);
            });

            // Load data for new languages only
            const newLanguagePromises = newLanguages.map(async (lang) => {
                try {
                    const repos = await this.dataFetcher.fetchTrendingRepos(lang, 'daily');
                    const result = {
                        language: lang,
                        timeRange: 'daily',
                        repos,
                        success: repos.length > 0
                    };
                    
                    // Process result immediately
                    this.processLanguageResult(result, container);
                    
                    return result;
                } catch (error) {
                    const result = {
                        language: lang,
                        timeRange: 'daily',
                        error,
                        success: false
                    };
                    
                    // Process error result immediately
                    this.processLanguageResult(result, container);
                    
                    return result;
                }
            });

            // Wait for new languages to load
            await Promise.all(newLanguagePromises);
        }
    }

    // Helper function to process individual language results
    processLanguageResult(result, container) {
        const lang = result.language;
        
        // Helper function for updating sections
        const createUpdateFunction = (language) => {
            return async (newTimeRange) => {
                try {
                    const newRepos = await this.dataFetcher.fetchWithCache(language, newTimeRange);
                    
                    const oldSection = container.querySelector(`[data-language="${language || 'all'}"]`);
                    const newSection = this.uiComponents.createLanguageSection(
                        language, 
                        newRepos, 
                        createUpdateFunction(language),
                        this.sectionTimeRanges
                    );
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
                        const errorSection = this.uiComponents.createErrorSection(
                            language, 
                            error, 
                            () => createUpdateFunction(language)(newTimeRange)
                        );
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
                const loadingSection = this.uiComponents.createLoadingSection(language);
                container.replaceChild(loadingSection, oldSection);
            }
            
            // Fetch data for this language
            try {
                const repos = await this.dataFetcher.fetchTrendingRepos(language, 'daily');
                if (repos.length > 0) {
                    const section = this.uiComponents.createLanguageSection(
                        language, 
                        repos, 
                        createUpdateFunction(language),
                        this.sectionTimeRanges
                    );
                    section.dataset.language = language || 'all';
                    const currentSection = container.querySelector(`[data-language="${language || 'all'}"]`);
                    if (currentSection) {
                        container.replaceChild(section, currentSection);
                    }
                } else {
                    throw new Error('No repositories found');
                }
            } catch (error) {
                const errorSection = this.uiComponents.createErrorSection(
                    language, 
                    error, 
                    () => retrySingleLanguage(language)
                );
                errorSection.dataset.language = language || 'all';
                const currentSection = container.querySelector(`[data-language="${language || 'all'}"]`);
                if (currentSection) {
                    container.replaceChild(errorSection, currentSection);
                }
            }
        };
        
        if (result.success && result.repos && result.repos.length > 0) {
            // Create successful section with data
            const section = this.uiComponents.createLanguageSection(
                lang, 
                result.repos, 
                createUpdateFunction(lang),
                this.sectionTimeRanges
            );
            section.dataset.language = lang || 'all';
            const oldSection = container.querySelector(`[data-language="${lang || 'all'}"]`);
            if (oldSection) {
                container.replaceChild(section, oldSection);
            }
        } else {
            // Show error section for failed or empty results
            const error = result.error || new Error('No repositories found');
            const errorSection = this.uiComponents.createErrorSection(
                lang, 
                error, 
                () => retrySingleLanguage(lang)
            );
            errorSection.dataset.language = lang || 'all';
            const oldSection = container.querySelector(`[data-language="${lang || 'all'}"]`);
            if (oldSection) {
                container.replaceChild(errorSection, oldSection);
            }
        }
    }

    // Background preloading function
    async preloadWeeklyMonthlyData() {
        console.log('Starting background preload of weekly and monthly data...');
        
        // Generate requests for weekly and monthly data for all languages
        const preloadRequests = [];
        this.languages.forEach(lang => {
            preloadRequests.push(
                { language: lang, timeRange: 'weekly' },
                { language: lang, timeRange: 'monthly' }
            );
        });
        
        try {
            const results = await this.dataFetcher.fetchMultipleConcurrent(preloadRequests, 5);
            
            // Store successful results in cache (already done by dataFetcher)
            results.forEach(result => {
                if (result.success && result.repos && result.repos.length > 0) {
                    console.log(`Preloaded ${result.language || 'overall'} ${result.timeRange} data: ${result.repos.length} repos`);
                }
            });
            
            console.log('Background preload completed');
        } catch (error) {
            console.error('Error during background preload:', error);
        }
    }

    // Display trending repositories (main function)
    async displayTrendingRepos() {
        const container = document.getElementById('trending-container');
        container.innerHTML = ''; // Clear existing content

        try {
            // Initialize time ranges and create placeholder sections
            this.languages.forEach(lang => {
                const key = lang || 'all';
                if (!this.sectionTimeRanges.has(key)) {
                    this.sectionTimeRanges.set(key, 'daily');
                }

                const section = this.uiComponents.createLoadingSection(lang);
                container.appendChild(section);
            });

            // Track completed loads for background preloading
            let completedLoads = 0;
            const totalLanguages = this.languages.length;

            // Fetch all daily data with concurrency limit and process individually
            const fetchPromises = this.languages.map(async (lang) => {
                try {
                    const repos = await this.dataFetcher.fetchTrendingRepos(lang, 'daily');
                    const result = {
                        language: lang,
                        timeRange: 'daily',
                        repos,
                        success: repos.length > 0
                    };
                    
                    // Process result immediately when this language completes
                    this.processLanguageResult(result, container);
                    
                    // Track completion for background preloading
                    completedLoads++;
                    if (completedLoads === totalLanguages) {
                        setTimeout(() => this.preloadWeeklyMonthlyData(), 1000);
                    }
                    
                    return result;
                } catch (error) {
                    const result = {
                        language: lang,
                        timeRange: 'daily',
                        error,
                        success: false
                    };
                    
                    // Process error result immediately
                    this.processLanguageResult(result, container);
                    
                    // Track completion for background preloading
                    completedLoads++;
                    if (completedLoads === totalLanguages) {
                        setTimeout(() => this.preloadWeeklyMonthlyData(), 1000);
                    }
                    
                    return result;
                }
            });

            // Wait for all to complete (for cleanup purposes)
            await Promise.all(fetchPromises);

        } catch (error) {
            console.error('Error fetching trending repositories:', error);
        }
    }

    // Initialize everything
    async initialize() {
        // Load settings first
        await this.loadLanguageSettings();
        
        // Initial load
        this.displayTrendingRepos();
    }
}

// Start the application when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new TrendingApp();
    });
} else {
    new TrendingApp();
}