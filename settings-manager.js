// Settings Manager Module
// Handles settings modal and language management

class SettingsManager {
    constructor(uiComponents) {
        this.ui = uiComponents;
        this.currentSelectedLanguages = [];
        this.initializeModal();
    }

    // Initialize settings modal
    initializeModal() {
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
        const populateLanguageCheckboxes = async (selectedLanguages) => {
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
                            <span class="language-dot mr-2 ${this.ui.getLanguageClass(language)}"></span>
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
                        const currentSelected = this.getCurrentSelectedLanguages();
                        await populateLanguageCheckboxes(currentSelected);
                    }
                });
            });
        };
        
        // Get currently selected languages from checkboxes
        this.getCurrentSelectedLanguages = () => {
            const checkboxes = languageCheckboxes.querySelectorAll('input[type="checkbox"]');
            const selected = [];
            checkboxes.forEach(checkbox => {
                if (checkbox.checked) {
                    const language = checkbox.id.replace('lang-', '');
                    selected.push(language);
                }
            });
            return selected;
        };

        // Add custom language functionality
        const addCustomLanguage = async () => {
            const languageName = customLanguageInput.value.trim();
            if (!languageName) {
                alert('Please enter a language name');
                return;
            }
            
            try {
                await window.LanguageSettings.addCustomLanguage(languageName);
                customLanguageInput.value = '';
                
                // Refresh the checkbox list
                const currentSelected = this.getCurrentSelectedLanguages();
                currentSelected.push(languageName); // Auto-select the new language
                await populateLanguageCheckboxes(currentSelected);
                
                alert(`Custom language "${languageName}" added successfully!`);
            } catch (error) {
                alert(`Error: ${error.message}`);
            }
        };
        
        addCustomLanguageBtn.addEventListener('click', addCustomLanguage);
        
        // Allow Enter key to add custom language
        customLanguageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addCustomLanguage();
            }
        });

        // Open settings modal
        settingsBtn.addEventListener('click', async () => {
            this.currentSelectedLanguages = await window.LanguageSettings.loadSelectedLanguages();
            await populateLanguageCheckboxes(this.currentSelectedLanguages);
            settingsModal.classList.remove('hidden');
        });

        // Close settings modal
        const closeModal = () => {
            settingsModal.classList.add('hidden');
        };

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

        // Save settings - this will be overridden by the main app
        this.onSaveSettings = null;
        saveSettings.addEventListener('click', async () => {
            if (this.onSaveSettings) {
                const selectedLanguages = this.getCurrentSelectedLanguages();
                await this.onSaveSettings(selectedLanguages);
                closeModal();
            }
        });
    }

    // Set save settings callback
    setSaveCallback(callback) {
        this.onSaveSettings = callback;
    }
}

// Export for global use
if (typeof window !== 'undefined') {
    window.SettingsManager = SettingsManager;
}