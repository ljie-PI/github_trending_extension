// Language configurations for GitHub Trending Extension

// Language colors mapping
const LANGUAGE_COLORS = {
    'Apex': '#1797c0',
    'Assembly': '#6E4C13',
    'C': '#555555',
    'C#': '#239120',
    'C++': '#f34b7d',
    'Clojure': '#db5855',
    'COBOL': '#2c5aa0',
    'Crystal': '#000100',
    'D': '#ba595e',
    'Dart': '#00B4AB',
    'F#': '#b845fc',
    'Fortran': '#4d41b1',
    'Go': '#00ADD8',
    'Groovy': '#e69f56',
    'Io': '#a9188d',
    'Java': '#b07219',
    'JavaScript': '#f1e05a',
    'Julia': '#a270ba',
    'Kotlin': '#A97BFF',
    'Lua': '#000080',
    'MATLAB': '#e16737',
    'Mojo': '#ff4500',
    'Nim': '#ffc200',
    'Objective-C': '#438eff',
    'OCaml': '#3be133',
    'Pascal': '#cc4125',
    'Perl': '#0298c3',
    'PHP': '#4F5D95',
    'Python': '#3572A5',
    'R': '#198CE7',
    'Raku': '#0000fb',
    'Ruby': '#701516',
    'Rust': '#dea584',
    'Swift': '#fa7343',
    'TypeScript': '#2b7489',
    'Zig': '#ec915c'
};

// Available languages (sorted alphabetically)
const AVAILABLE_LANGUAGES = Object.keys(LANGUAGE_COLORS).sort();

// Default selected languages (these will be loaded by default)
const DEFAULT_SELECTED_LANGUAGES = ['Python', 'TypeScript', 'Rust', 'Lua', 'C', 'C++', 'Java', 'Go'];

// Settings keys for chrome storage
const SETTINGS_KEYS = {
    SELECTED_LANGUAGES: 'selected_languages',
    CUSTOM_LANGUAGES: 'custom_languages'
};

// Get language color
function getLanguageColor(language) {
    return LANGUAGE_COLORS[language] || '#8b5cf6';
}

// Get default languages configuration
function getDefaultLanguages() {
    return DEFAULT_SELECTED_LANGUAGES;
}

// Get all available languages (including custom ones)
async function getAvailableLanguages() {
    const customLanguages = await loadCustomLanguages();
    const allLanguages = [...AVAILABLE_LANGUAGES, ...customLanguages];
    return [...new Set(allLanguages)].sort(); // Remove duplicates and sort
}

// Get predefined languages only
function getPredefinedLanguages() {
    return AVAILABLE_LANGUAGES;
}

// Save selected languages to storage
async function saveSelectedLanguages(selectedLanguages) {
    return new Promise(resolve => {
        chrome.storage.local.set({
            [SETTINGS_KEYS.SELECTED_LANGUAGES]: selectedLanguages
        }, resolve);
    });
}

// Load selected languages from storage
async function loadSelectedLanguages() {
    return new Promise(resolve => {
        chrome.storage.local.get(SETTINGS_KEYS.SELECTED_LANGUAGES, result => {
            const selected = result[SETTINGS_KEYS.SELECTED_LANGUAGES];
            resolve(selected || DEFAULT_SELECTED_LANGUAGES);
        });
    });
}

// Save custom languages to storage
async function saveCustomLanguages(customLanguages) {
    return new Promise(resolve => {
        chrome.storage.local.set({
            [SETTINGS_KEYS.CUSTOM_LANGUAGES]: customLanguages
        }, resolve);
    });
}

// Load custom languages from storage
async function loadCustomLanguages() {
    return new Promise(resolve => {
        chrome.storage.local.get(SETTINGS_KEYS.CUSTOM_LANGUAGES, result => {
            const custom = result[SETTINGS_KEYS.CUSTOM_LANGUAGES];
            resolve(custom || []);
        });
    });
}

// Add a custom language
async function addCustomLanguage(languageName) {
    if (!languageName || languageName.trim() === '') {
        throw new Error('Language name cannot be empty');
    }

    const trimmedName = languageName.trim();
    const customLanguages = await loadCustomLanguages();

    // Check if language already exists (in predefined or custom)
    if (AVAILABLE_LANGUAGES.includes(trimmedName) || customLanguages.includes(trimmedName)) {
        throw new Error('Language already exists');
    }

    customLanguages.push(trimmedName);
    await saveCustomLanguages(customLanguages);
    return trimmedName;
}

// Remove a custom language
async function removeCustomLanguage(languageName) {
    const customLanguages = await loadCustomLanguages();
    const filteredLanguages = customLanguages.filter(lang => lang !== languageName);
    await saveCustomLanguages(filteredLanguages);
}

// Export for use in other files
if (typeof window !== 'undefined') {
    window.LanguageSettings = {
        getLanguageColor,
        getDefaultLanguages,
        getAvailableLanguages,
        getPredefinedLanguages,
        saveSelectedLanguages,
        loadSelectedLanguages,
        saveCustomLanguages,
        loadCustomLanguages,
        addCustomLanguage,
        removeCustomLanguage,
        LANGUAGE_COLORS,
        AVAILABLE_LANGUAGES,
        DEFAULT_SELECTED_LANGUAGES
    };
}
