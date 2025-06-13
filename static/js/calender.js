class TimeAnalyzer {
    constructor() {
        console.info('[TimeAnalyzer] Initializing TimeAnalyzer...');
        this.records = [];
        this.processingErrors = [];
        this.cache = new Map();
        this.currentSunburstAggregatedData = null; 
        this.filteredRecordsForCharts = []; 
        this.loadingToast = null;
        this.localStorageKey = 'timeAnalyzerFileCache';
        this.uiStateKey = 'timeAnalyzerUIState_v3'; // Consider bumping version if state structure changes significantly
        this.cacheTimestampKey = 'timeAnalyzerCacheTimestamp';
        this.cacheTimestamp = null;
        this.cacheWarningToast = null;
        this.allHierarchies = [];
        this.allProjects = [];
        this.flatpickrInstance = null; // For the date range picker
        this.loadCacheFromLocalStorage();
        this.initializeEventListeners();
        this.loadUIState(); 
        this.updateCacheStatusDisplay();
        console.info('[TimeAnalyzer] Initialization complete.');
    }

    initializeEventListeners() {
        console.log('[TimeAnalyzer.initializeEventListeners] Setting up event listeners...');
        document.getElementById('folderInput')?.addEventListener('change', (e) => this.handleFolderSelect(e));
        this.setupAutocomplete('hierarchyFilterInput', 'hierarchySuggestions', () => this.allHierarchies, () => this.updateAnalysis());
        this.setupAutocomplete('projectFilterInput', 'projectSuggestions', () => this.allProjects, () => this.updateAnalysis());
        
        // Initialize Flatpickr for date range selection
        const dateRangePickerEl = document.getElementById('dateRangePicker');
        if (dateRangePickerEl && typeof flatpickr !== 'undefined') {
            this.flatpickrInstance = flatpickr(dateRangePickerEl, {
                mode: "range",
                dateFormat: "Y-m-d", // Internal format
                altInput: true,      // Show user a different format
                altFormat: "M j, Y", // User-friendly format (e.g., Aug 29, 2023)
                onChange: (selectedDates, dateStr, instance) => {
                    // Trigger update if two dates are selected, or if cleared (selectedDates.length === 0)
                    if (selectedDates.length === 2 || selectedDates.length === 0) {
                        this.updateAnalysis();
                    }
                },
                 // onClose might be useful if onChange doesn't catch all manual input changes
                onClose: (selectedDates, dateStr, instance) => {
                    // Check if selection actually changed to avoid redundant updates
                    if (instance.input.value !== instance._initialValue && (selectedDates.length === 2 || selectedDates.length === 0)) {
                       this.updateAnalysis();
                    }
                }
            });
        } else {
            console.warn('[TimeAnalyzer] Flatpickr input not found or Flatpickr library not loaded.');
             // Fallback for old date inputs if needed, or ensure they are removed from HTML
            document.getElementById('startDate')?.addEventListener('change', () => this.updateAnalysis());
            document.getElementById('endDate')?.addEventListener('change', () => this.updateAnalysis());
        }

        document.getElementById('clearDatesBtn')?.addEventListener('click', () => this.clearDateFilters());
        document.getElementById('clearCacheBtn')?.addEventListener('click', () => this.clearLocalStorageCache());
        document.getElementById('setTodayBtn')?.addEventListener('click', () => this.setPresetDateRange('today'));
        document.getElementById('setYesterdayBtn')?.addEventListener('click', () => this.setPresetDateRange('yesterday'));
        document.getElementById('setThisWeekBtn')?.addEventListener('click', () => this.setPresetDateRange('thisWeek'));
        document.getElementById('setThisMonthBtn')?.addEventListener('click', () => this.setPresetDateRange('thisMonth'));
        document.getElementById('analysisTypeSelect')?.addEventListener('change', () => this.handleAnalysisTypeChange());
        document.getElementById('levelSelect_pie')?.addEventListener('change', () => this.updateAnalysis());
        document.getElementById('levelSelect')?.addEventListener('change', () => this.updateAnalysis());
        document.getElementById('patternInput')?.addEventListener('input', () => this.debounce(() => this.updateAnalysis(), 300)());
        document.getElementById('timeSeriesGranularitySelect')?.addEventListener('change', () => this.updateAnalysis());
        document.getElementById('timeSeriesTypeSelect')?.addEventListener('change', () => {
            this.handleTimeSeriesTypeVis(); 
            this.updateAnalysis();
        });
        document.getElementById('timeSeriesStackingLevelSelect')?.addEventListener('change', () => this.updateAnalysis());
        document.getElementById('activityPatternTypeSelect')?.addEventListener('change', () => this.updateAnalysis());
        document.getElementById('popupCloseBtn')?.addEventListener('click', () => this.hideDetailPopup());
        document.getElementById('detailOverlay')?.addEventListener('click', () => this.hideDetailPopup());
        console.log('[TimeAnalyzer.initializeEventListeners] Event listeners setup complete.');
    }
    
    handleAnalysisTypeChange() {
        const analysisType = document.getElementById('analysisTypeSelect').value;
        console.log(`[TimeAnalyzer.handleAnalysisTypeChange] New type: ${analysisType}`);

        const specificControlContainers = [
            'sunburstBreakdownLevelContainer', 'pieBreakdownLevelContainer', 'pieCategoryFilterContainer',
            'timeSeriesGranularityContainer', 'timeSeriesTypeContainer', 'timeSeriesStackingLevelContainer',
            'activityPatternTypeContainer'
        ];
        specificControlContainers.forEach(id => document.getElementById(id)?.classList.add('hidden-controls'));
        
        if (analysisType === 'sunburst') {
            document.getElementById('sunburstBreakdownLevelContainer')?.classList.remove('hidden-controls');
            document.getElementById('pieCategoryFilterContainer')?.classList.remove('hidden-controls');
        } else if (analysisType === 'pie') {
            document.getElementById('pieBreakdownLevelContainer')?.classList.remove('hidden-controls');
            document.getElementById('pieCategoryFilterContainer')?.classList.remove('hidden-controls');
        } else if (analysisType === 'time-series') {
            document.getElementById('timeSeriesGranularityContainer')?.classList.remove('hidden-controls');
            document.getElementById('timeSeriesTypeContainer')?.classList.remove('hidden-controls');
            this.handleTimeSeriesTypeVis(); 
        } else if (analysisType === 'activity') {
            document.getElementById('activityPatternTypeContainer')?.classList.remove('hidden-controls');
        }
        this.updateAnalysis();
    }

    handleTimeSeriesTypeVis() { 
        const timeSeriesType = document.getElementById('timeSeriesTypeSelect')?.value;
        const stackingLevelContainer = document.getElementById('timeSeriesStackingLevelContainer');
        if (stackingLevelContainer) {
            if (timeSeriesType === 'stackedArea') {
                stackingLevelContainer.classList.remove('hidden-controls');
            } else {
                stackingLevelContainer.classList.add('hidden-controls');
            }
        }
    }

    saveUIState() {
        const state = {
            analysisTypeSelect: document.getElementById('analysisTypeSelect')?.value,
            hierarchyFilter: document.getElementById('hierarchyFilterInput')?.value,
            projectFilter: document.getElementById('projectFilterInput')?.value,
            // startDate and endDate are now derived from flatpickr
            levelSelect_pie: document.getElementById('levelSelect_pie')?.value,
            levelSelect: document.getElementById('levelSelect')?.value,
            patternInput: document.getElementById('patternInput')?.value,
            timeSeriesGranularity: document.getElementById('timeSeriesGranularitySelect')?.value,
            timeSeriesType: document.getElementById('timeSeriesTypeSelect')?.value,
            timeSeriesStackingLevel: document.getElementById('timeSeriesStackingLevelSelect')?.value,
            activityPatternType: document.getElementById('activityPatternTypeSelect')?.value,
        };
        if (this.flatpickrInstance && this.flatpickrInstance.selectedDates.length === 2) {
            state.startDate = this._getISODate(this.flatpickrInstance.selectedDates[0]);
            state.endDate = this._getISODate(this.flatpickrInstance.selectedDates[1]);
        } else {
            state.startDate = '';
            state.endDate = '';
        }
        localStorage.setItem(this.uiStateKey, JSON.stringify(Object.fromEntries(Object.entries(state).filter(([_, v]) => v != null))));
    }
    
    _updateAutocompleteClearButtonVisibility(inputElement) {
        if (!inputElement) return;
        const wrapper = inputElement.closest('.autocomplete-wrapper');
        if (wrapper) {
            const clearButton = wrapper.querySelector('.clear-input-btn');
            if (clearButton) {
                clearButton.style.display = inputElement.value.length > 0 ? 'inline' : 'none';
            }
        }
    }

    loadUIState() {
        const savedState = localStorage.getItem(this.uiStateKey);
        if (savedState) {
            try {
                const state = JSON.parse(savedState);
                const setVal = (id, val, isSelect = true) => {
                    const el = document.getElementById(id);
                    if (el && val !== undefined) {
                        if (isSelect) {
                            if (Array.from(el.options).some(opt => opt.value === val)) el.value = val;
                        } else {
                            el.value = val;
                        }
                        if (id === 'hierarchyFilterInput' || id === 'projectFilterInput') {
                            this._updateAutocompleteClearButtonVisibility(el);
                        }
                    }
                };
                setVal('analysisTypeSelect', state.analysisTypeSelect);
                setVal('hierarchyFilterInput', state.hierarchyFilter, false);
                setVal('projectFilterInput', state.projectFilter, false);
                
                // Load dates into Flatpickr
                if (state.startDate && state.endDate && this.flatpickrInstance) {
                     // Use timeout to ensure flatpickr is ready, esp. on initial load
                    setTimeout(() => {
                        this.flatpickrInstance.setDate([state.startDate, state.endDate], false); // false: don't trigger onChange
                    }, 0);
                } else if (this.flatpickrInstance) {
                     setTimeout(() => {
                        this.flatpickrInstance.clear(false);
                    }, 0);
                }

                setVal('levelSelect_pie', state.levelSelect_pie);
                setVal('levelSelect', state.levelSelect);
                setVal('patternInput', state.patternInput, false);
                setVal('timeSeriesGranularitySelect', state.timeSeriesGranularity);
                setVal('timeSeriesTypeSelect', state.timeSeriesType);
                setVal('timeSeriesStackingLevelSelect', state.timeSeriesStackingLevel);
                setVal('activityPatternTypeSelect', state.activityPatternType);
            } catch (error) {
                console.error("[TimeAnalyzer.loadUIState] Error:", error);
                localStorage.removeItem(this.uiStateKey);
            }
        }
        this.handleAnalysisTypeChange(); 
    }

    _getISODate(date) { 
        return (date instanceof Date && !isNaN(date.getTime())) ? date.toISOString().split('T')[0] : null; 
    }
    _getWeekStartDate(date) { 
        if (!(date instanceof Date) || isNaN(date.getTime())) return null;
        const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
        const day = d.getUTCDay(); 
        const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1); 
        return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
    }
    _getMonthStartDate(date) { 
        return (date instanceof Date && !isNaN(date.getTime())) ? new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)) : null; 
    }
    _getHourFromTimeStr(timeStr) {
        if (timeStr == null) return null;
        if (typeof timeStr === 'number') {
            const hour = Math.floor(timeStr);
            return hour >= 0 && hour <= 23 ? hour : null; 
        }
        const sTimeStr = String(timeStr);
        const timeMatch = sTimeStr.match(/^(\d{1,2}):(\d{2})/);
        if (timeMatch) {
            const hour = parseInt(timeMatch[1], 10);
            return hour >= 0 && hour <= 23 ? hour : null;
        }
        try {
            const d = new Date(sTimeStr); 
            if (!isNaN(d.getTime())) {
                const hour = d.getUTCHours();
                return hour >= 0 && hour <= 23 ? hour : null;
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    setupAutocomplete(inputId, suggestionsId, getDataFunc, onSelectCallback) {
        const input = document.getElementById(inputId);
        const suggestionsContainer = document.getElementById(suggestionsId);
        if (!input || !suggestionsContainer) return;

        let clearButtonId = (inputId === 'hierarchyFilterInput') ? 'clearHierarchyFilterBtn' : ((inputId === 'projectFilterInput') ? 'clearProjectFilterBtn' : null);
        const clearButton = clearButtonId ? document.getElementById(clearButtonId) : null;
        let activeSuggestionIndex = -1;

        const updateClearButtonVisibility = () => {
            if (clearButton) {
                clearButton.style.display = input.value.length > 0 ? 'inline' : 'none';
            }
        };
        const populateSuggestions = (items) => {
            suggestionsContainer.innerHTML = '';
            activeSuggestionIndex = -1;
            if (items.length > 0) {
                items.forEach(item => {
                    const div = document.createElement('div');
                    div.textContent = item;
                    div.addEventListener('click', () => {
                        input.value = item;
                        suggestionsContainer.innerHTML = '';
                        suggestionsContainer.style.display = 'none';
                        updateClearButtonVisibility();
                        if (onSelectCallback) onSelectCallback();
                    });
                    suggestionsContainer.appendChild(div);
                });
                suggestionsContainer.style.display = 'block';
            } else {
                suggestionsContainer.style.display = 'none';
            }
        };

        input.addEventListener('focus', () => {
            const value = input.value.toLowerCase().trim();
            const data = getDataFunc();
            populateSuggestions(value === '' ? data : data.filter(item => item.toLowerCase().includes(value)));
            updateClearButtonVisibility();
        });
        input.addEventListener('input', () => {
            updateClearButtonVisibility();
            const value = input.value.toLowerCase().trim();
            const data = getDataFunc();
            populateSuggestions(value === '' ? (onSelectCallback(), data) : data.filter(item => item.toLowerCase().includes(value)));
        });
        input.addEventListener('blur', () => {
            setTimeout(() => {
                if (!suggestionsContainer.contains(document.activeElement) && (!clearButton || !clearButton.contains(document.activeElement))) {
                    suggestionsContainer.style.display = 'none';
                }
            }, 150);
        });
        input.addEventListener('keydown', (e) => {
            updateClearButtonVisibility();
            let currentSuggestions = Array.from(suggestionsContainer.children);
            if (e.key === 'Enter') {
                e.preventDefault();
                if (activeSuggestionIndex > -1 && currentSuggestions[activeSuggestionIndex]) {
                    currentSuggestions[activeSuggestionIndex].click();
                } else {
                    suggestionsContainer.innerHTML = '';
                    suggestionsContainer.style.display = 'none';
                    updateClearButtonVisibility();
                    if (onSelectCallback) onSelectCallback();
                }
            } else if (e.key === 'Escape') {
                suggestionsContainer.innerHTML = '';
                suggestionsContainer.style.display = 'none';
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                if (suggestionsContainer.style.display === 'none' || currentSuggestions.length === 0) {
                    const value = input.value.toLowerCase().trim();
                    const data = getDataFunc();
                    populateSuggestions(value === '' ? data : data.filter(item => item.toLowerCase().includes(value)));
                    currentSuggestions = Array.from(suggestionsContainer.children);
                }
                if (currentSuggestions.length > 0) {
                    e.preventDefault();
                    activeSuggestionIndex = (e.key === 'ArrowDown') ? (activeSuggestionIndex + 1) % currentSuggestions.length : (activeSuggestionIndex - 1 + currentSuggestions.length) % currentSuggestions.length;
                    this.updateActiveSuggestion(currentSuggestions, activeSuggestionIndex);
                }
            }
        });
        if (clearButton) {
            clearButton.addEventListener('click', () => {
                input.value = '';
                input.focus();
                updateClearButtonVisibility();
                populateSuggestions(getDataFunc());
                if (onSelectCallback) onSelectCallback();
            });
        }
        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !suggestionsContainer.contains(e.target) && (!clearButton || !clearButton.contains(e.target))) {
                suggestionsContainer.style.display = 'none';
            }
        });
        updateClearButtonVisibility();
    }

    updateActiveSuggestion(suggestions, index) {
        suggestions.forEach((suggestion, idx) => suggestion.classList.toggle('active', idx === index));
    }

    setPresetDateRange(preset) {
        const today = new Date();
        let startDate, endDate;
        switch (preset) {
            case 'today': startDate = today; endDate = today; break;
            case 'yesterday': startDate = new Date(today); startDate.setDate(today.getDate() - 1); endDate = startDate; break;
            case 'thisWeek': startDate = new Date(today); const day = today.getDay(); startDate.setDate(today.getDate() - (day === 0 ? 6 : day - 1)); endDate = new Date(startDate); endDate.setDate(startDate.getDate() + 6); break; // Monday as start
            case 'thisMonth': startDate = new Date(today.getFullYear(), today.getMonth(), 1); endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); break;
            default: return;
        }
        // const formatDate = (d) => d.toISOString().split('T')[0]; // Not needed if passing Date objects
        if (this.flatpickrInstance) {
            this.flatpickrInstance.setDate([startDate, endDate], true); // true to trigger onChange
        }
    }

    loadCacheFromLocalStorage() {
        try {
            const cachedData = localStorage.getItem(this.localStorageKey);
            const storedTimestamp = localStorage.getItem(this.cacheTimestampKey);
            if (storedTimestamp) this.cacheTimestamp = parseInt(storedTimestamp, 10);
            else this.cacheTimestamp = null;

            if (cachedData) {
                const parsedCache = JSON.parse(cachedData);
                if (Array.isArray(parsedCache)) {
                    this.cache = new Map(parsedCache.map(([key, record]) => {
                        if (record.date && typeof record.date === 'string') record.date = new Date(record.date);
                        return [key, record];
                    }));
                    if (this.cache.size > 0) {
                        this.records = Array.from(this.cache.values());
                        this.populateFilterDataSources();
                    }
                } else {
                    this.cache = new Map();
                    localStorage.removeItem(this.localStorageKey);
                    localStorage.removeItem(this.cacheTimestampKey);
                    this.cacheTimestamp = null;
                }
            }
        } catch (e) {
            this.cache = new Map();
            localStorage.removeItem(this.localStorageKey);
            localStorage.removeItem(this.cacheTimestampKey);
            this.cacheTimestamp = null;
        }
    }

    saveCacheToLocalStorage() {
        try {
            localStorage.setItem(this.localStorageKey, JSON.stringify(Array.from(this.cache.entries())));
            this.cacheTimestamp = Date.now();
            localStorage.setItem(this.cacheTimestampKey, this.cacheTimestamp.toString());
        } catch (e) {
            if (e.name === 'QuotaExceededError') this.showStatus('Cache storage limit reached.', 'error', 7000);
        }
        this.updateCacheStatusDisplay();
    }

    clearLocalStorageCache() {
        localStorage.removeItem(this.localStorageKey);
        localStorage.removeItem(this.cacheTimestampKey);
        this.cache = new Map();
        this.records = [];
        this.processingErrors = [];
        this.cacheTimestamp = null;
        this.showStatus('Local storage cache cleared.', 'success');
        this.populateFilterDataSources();
        this.updateCacheStatusDisplay();
        this.updateAnalysis();
    }

    formatTimeAgo(timestamp) {
        if (!timestamp) return 'never';
        const now = Date.now();
        const seconds = Math.round((now - timestamp) / 1000);
        if (seconds < 2) return 'just now';
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.round(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.round(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.round(hours / 24);
        if (days <= 30) return `${days}d ago`;
        const months = Math.round(days / 30);
        if (months < 12) return `${months}mo ago`;
        return `${Math.round(months / 12)}y ago`;
    }

    updateCacheStatusDisplay() {
        const cacheStatusEl = document.getElementById('cacheStatusDisplay');
        // CHANGE: Target the wrapper, not just the button, to animate both elements.
        const fileInputWrapper = document.querySelector('.file-input-wrapper');
        if (!cacheStatusEl || !fileInputWrapper) return;

        // This line correctly removes the animation class when the cache is updated.
        fileInputWrapper.classList.remove('needs-attention');
        if (this.cacheWarningToast) {
            this.hideSpecificToast(this.cacheWarningToast);
            this.cacheWarningToast = null;
        }

        if (this.cacheTimestamp) {
            const lastUpdateDate = new Date(this.cacheTimestamp);
            const timeAgo = this.formatTimeAgo(this.cacheTimestamp);
            let statusText = `Local cache updated: <strong>${lastUpdateDate.toLocaleDateString()} ${lastUpdateDate.toLocaleTimeString()}</strong> (${timeAgo}).`;
            if (Date.now() - this.cacheTimestamp > 24 * 60 * 60 * 1000 && this.cache.size > 0) {
                statusText += `<br><strong style="color:#c2410c;">Warning: Cache is older than 24 hours. Consider re-selecting folder.</strong>`;
                this.cacheWarningToast = this.showStatus('Cache data is > 24 hours old. Re-select folder for latest data.', 'warning', 30000);
                // CHANGE: Apply class and animation reset to the wrapper.
                fileInputWrapper.classList.add('needs-attention');
                fileInputWrapper.style.animation = 'none'; void fileInputWrapper.offsetHeight; fileInputWrapper.style.animation = ''; 
                if (navigator.vibrate) navigator.vibrate([150, 50, 150]);
            }
            cacheStatusEl.innerHTML = statusText;
        } else {
            cacheStatusEl.innerHTML = 'Local cache is empty.';
        }
    }

    debounce(func, delay) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    clearDateFilters() {
        if (this.flatpickrInstance) {
            this.flatpickrInstance.clear(); // This should trigger onChange if configured, or manually update
        }
        // Ensure analysis updates if clear() doesn't trigger onChange sufficiently
        // this.updateAnalysis(); // The flatpickr onChange should handle this.
    }

    showStatus(message, type = 'info', duration = 5000) {
        const toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) return null;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = message;
        toastContainer.appendChild(toast);
        requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('visible')));
        if (type !== 'info-persistent') {
            setTimeout(() => this.hideSpecificToast(toast), duration);
        }
        return toast;
    }

    hideSpecificToast(toastElement) {
        if (toastElement && toastElement.parentNode) {
            toastElement.classList.remove('visible');
            toastElement.addEventListener('transitionend', () => toastElement.parentNode?.removeChild(toastElement), { once: true });
        }
    }

    async handleFolderSelect(event) {
        const filesArray = Array.from(event.target.files || []).filter(f => f.name.toLowerCase().endsWith('.md'));
        event.target.value = null; 
        if (filesArray.length === 0) {
            this.showStatus('No .md files found.', 'error');
            return;
        }
        if (this.loadingToast) this.hideSpecificToast(this.loadingToast);
        this.loadingToast = this.showStatus(`<span class="loading"></span> Processing ${filesArray.length} files...`, 'info-persistent');
        await this.processFiles(filesArray);
    }

    async parseFile(file) {
        try {
            const fileContent = await file.text();
            const pathParts = file.webkitRelativePath.split('/');
            const hierarchy = pathParts.length > 2 ? pathParts[1] : (pathParts.length > 1 && pathParts[0] !== "" ? pathParts[0] : 'root');
            const filenameRegex = /^(?:(\d{4}-\d{2}-\d{2})\s+(.+?)\s+-\s+(.+?)(?:\s+([IVXLCDM\d]+))?|(?:\(([^)]+)\)\s*)(.+?)(?:\s*-\s*(.+?))?(?:\s+([IVXLCDM\d]+))?)\.md$/i;
            const filenameMatch = file.name.match(filenameRegex);
            if (!filenameMatch) throw new Error('Filename pattern mismatch.');

            let dateStr, projectFromFile, subprojectRaw, serialFromFile;
            if (filenameMatch[1]) { 
                dateStr = filenameMatch[1]; projectFromFile = filenameMatch[2]; subprojectRaw = filenameMatch[3]; serialFromFile = filenameMatch[4];
            } else { 
                projectFromFile = filenameMatch[6]; subprojectRaw = filenameMatch[7]; serialFromFile = filenameMatch[8];
            }

            if (typeof jsyaml === 'undefined') throw new Error('js-yaml library missing.');
            const yamlMatch = fileContent.match(/^---\s*\n([\s\S]*?)\n---/);
            if (!yamlMatch) throw new Error('No YAML front matter found.');
            let metadata;
            try { metadata = jsyaml.load(yamlMatch[1]); } 
            catch (e) { throw new Error(`Invalid YAML: ${e.message}`); }
            if (!metadata || typeof metadata !== 'object') throw new Error('YAML front matter empty or not an object.');
            
            let eventDuration = (metadata.type === 'recurring') 
                ? (metadata.startTime && metadata.endTime ? this.calculateDuration(metadata.startTime, metadata.endTime, 1) : 0) // Base duration for one occurrence
                : this.calculateDuration(metadata.startTime, metadata.endTime, metadata.days);

            let recordDate = null;
            if (dateStr) {
                const [year, month, day] = dateStr.split('-').map(Number);
                recordDate = new Date(Date.UTC(year, month - 1, day));
            } else if (metadata.date) {
                const metaDateVal = metadata.date;
                if (metaDateVal instanceof Date && !isNaN(metaDateVal.getTime())) {
                    recordDate = new Date(Date.UTC(metaDateVal.getFullYear(), metaDateVal.getMonth(), metaDateVal.getDate()));
                } else {
                    const metaDateStr = String(metaDateVal);
                    const datePartsMatch = metaDateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
                    if (datePartsMatch) {
                        const [year, month, day] = datePartsMatch.slice(1, 4).map(Number);
                        recordDate = new Date(Date.UTC(year, month - 1, day));
                    } else {
                        let parsedFallbackDate = new Date(metaDateStr);
                        if (!isNaN(parsedFallbackDate.getTime())) {
                            recordDate = new Date(Date.UTC(parsedFallbackDate.getFullYear(), parsedFallbackDate.getMonth(), parsedFallbackDate.getDate()));
                        }
                    }
                }
            }
            if (recordDate && isNaN(recordDate.getTime())) throw new Error(`Invalid date parsed: ${dateStr || metadata.date}`);

            const finalProject = projectFromFile ? projectFromFile.trim() : 'Unknown Project';
            let baseSubproject = 'none', fullSubproject = 'none';
            if (subprojectRaw) {
                subprojectRaw = subprojectRaw.trim();
                const subprojectSerialMatch = subprojectRaw.match(/^(.*?)\s+([IVXLCDM\d]+)$/);
                if (subprojectSerialMatch) {
                    baseSubproject = subprojectSerialMatch[1].trim(); 
                    serialFromFile = serialFromFile || subprojectSerialMatch[2]; 
                } else { baseSubproject = subprojectRaw; }
                fullSubproject = baseSubproject;
                if (serialFromFile) fullSubproject += ` ${serialFromFile.trim()}`;
            }
            if (baseSubproject === "") baseSubproject = 'none';
            fullSubproject = fullSubproject.trim(); if (fullSubproject === "") fullSubproject = 'none';

            return {
                path: file.webkitRelativePath, hierarchy, project: finalProject, subproject: baseSubproject, subprojectFull: fullSubproject,
                duration: eventDuration, file: file.name, date: recordDate, metadata
            };
        } catch (error) {
            console.error(`[TimeAnalyzer.parseFile] Error parsing file '${file.name}': ${error.message}`, error);
            throw error;
        }
    }

    calculateDuration(startTime, endTime, days = 1) {
        const parseTime = (timeStr) => {
            if (timeStr == null) throw new Error('Invalid time: null or undefined.');
            if (typeof timeStr === 'number') {
                if (isNaN(timeStr) || !isFinite(timeStr)) throw new Error(`Invalid numeric time: ${timeStr}`);
                return { hours: Math.floor(timeStr), minutes: Math.round((timeStr - Math.floor(timeStr)) * 60) };
            }
            const sTimeStr = String(timeStr);
            const timeMatch = sTimeStr.match(/^(\d{1,2}):(\d{2})/); // Only need HH:MM
            if (timeMatch) return { hours: parseInt(timeMatch[1]), minutes: parseInt(timeMatch[2]) };
            try {
                const d = new Date(sTimeStr);
                if (!isNaN(d.getTime())) return { hours: d.getUTCHours(), minutes: d.getUTCMinutes() };
            } catch (e) { /* ignore */ }
            throw new Error(`Invalid time format: ${sTimeStr}. Use HH:MM or decimal hours.`);
        };
        try {
            const start = parseTime(startTime);
            const end = parseTime(endTime);
            let startMinutes = start.hours * 60 + start.minutes;
            let endMinutes = end.hours * 60 + end.minutes;
            if (endMinutes < startMinutes) endMinutes += 24 * 60; // Handles overnight
            
            const durationForOneDay = (endMinutes - startMinutes) / 60;
            const numDays = Number(days) || 0;
            return durationForOneDay * (Math.max(0, numDays));
        } catch (err) {
            // console.warn(`Duration calculation error for (start:"${startTime}", end:"${endTime}", days:${days}): ${err.message}. Returning 0.`);
            return 0;
        }
    }

    async processFiles(filesArray) {
        this.records = []; this.processingErrors = [];
        let processedFreshlyCount = 0, usedFromCacheCount = 0;
        const newCacheForThisSession = new Map();
        const filesToParse = [];

        for (const file of filesArray) {
            const cacheKey = `${file.webkitRelativePath}-${file.lastModified}`;
            if (this.cache.has(cacheKey)) {
                const record = this.cache.get(cacheKey);
                if (record.date && typeof record.date === 'string') record.date = new Date(record.date);
                this.records.push(record);
                newCacheForThisSession.set(cacheKey, record);
                usedFromCacheCount++;
            } else {
                filesToParse.push(file);
            }
        }

        if (this.loadingToast) this.hideSpecificToast(this.loadingToast); this.loadingToast = null;
        let currentlyUsingWorkers = (typeof Worker !== 'undefined'), workerPathErrorNotified = false;

        if (filesToParse.length > 0) {
            this.loadingToast = this.showStatus(`<span class="loading"></span> Parsing ${filesToParse.length} new files (${usedFromCacheCount} from cache)...`, 'info-persistent');
        } else if (usedFromCacheCount > 0) {
            this.showStatus(`All ${usedFromCacheCount} files loaded from cache.`, 'success');
        }

        const promises = filesToParse.map(file => new Promise(async (resolve) => {
            const cacheKey = `${file.webkitRelativePath}-${file.lastModified}`;
            if (currentlyUsingWorkers) {
                let worker;
                try {
                    worker = new Worker('Self-development/parser.worker.js'); // Ensure this path is correct
                    worker.onmessage = (event) => {
                        const { type, data } = event.data;
                        if (type === 'parsed_record') {
                            if (data.date && typeof data.date === 'string') data.date = new Date(data.date);
                            resolve({ status: 'ok', record: data, cacheKey });
                        } else if (type === 'parse_error') {
                            resolve({ status: 'err', errorData: data });
                        }
                        worker.terminate();
                    };
                    worker.onerror = () => {
                        if (!workerPathErrorNotified) { this.showStatus('Worker error. Using main thread.', 'warning', 7000); workerPathErrorNotified = true; }
                        currentlyUsingWorkers = false; worker.terminate();
                        this.parseFile(file).then(record => resolve({ status: 'ok', record, cacheKey })).catch(error => resolve({ status: 'err', errorData: { filePath: file.webkitRelativePath, fileName: file.name, error: error.message } }));
                    };
                    const fileContent = await file.text();
                    worker.postMessage({ file: { name: file.name, webkitRelativePath: file.webkitRelativePath, content: fileContent, lastModified: file.lastModified } });
                } catch (workerConstructionError) {
                    if (!workerPathErrorNotified) { this.showStatus('Worker creation failed. Main thread.', 'warning', 7000); workerPathErrorNotified = true; }
                    currentlyUsingWorkers = false;
                    this.parseFile(file).then(record => resolve({ status: 'ok', record, cacheKey })).catch(error => resolve({ status: 'err', errorData: { filePath: file.webkitRelativePath, fileName: file.name, error: error.message } }));
                }
            } else {
                if (filesToParse.indexOf(file) === 0 && this.loadingToast && !this.loadingToast.innerHTML.includes("main thread")) { // Update toast if falling back for the first time
                    if(this.loadingToast) this.hideSpecificToast(this.loadingToast);
                    this.loadingToast = this.showStatus(`<span class="loading"></span> Parsing ${filesToParse.length} new files on main thread...`, 'info-persistent');
                }
                try {
                    const record = await this.parseFile(file);
                    resolve({ status: 'ok', record, cacheKey });
                } catch (error) {
                    resolve({ status: 'err', errorData: { filePath: file.webkitRelativePath, fileName: file.name, error: error.message } });
                }
            }
        }));

        const results = await Promise.all(promises);
        results.forEach(result => {
            if (result.status === 'ok' && result.record) {
                this.records.push(result.record);
                newCacheForThisSession.set(result.cacheKey, result.record);
                processedFreshlyCount++;
            } else if (result.status === 'err' && result.errorData) {
                this.processingErrors.push({ file: result.errorData.fileName || 'Unknown', path: result.errorData.filePath || 'N/A', reason: result.errorData.error || 'Unknown' });
            }
        });

        this.cache = newCacheForThisSession;
        if (this.cache.size > 0) this.saveCacheToLocalStorage();
        else if (filesArray.length > 0 && this.cache.size === 0) { // All files failed or were somehow not cached
            localStorage.removeItem(this.localStorageKey); localStorage.removeItem(this.cacheTimestampKey); this.cacheTimestamp = null;
        }

        if (this.loadingToast) { this.hideSpecificToast(this.loadingToast); this.loadingToast = null; }
        let finalStatusMessage = `Processed: ${processedFreshlyCount} new, ${usedFromCacheCount} from cache. Total valid: ${this.records.length}.`;
        if (this.processingErrors.length > 0) finalStatusMessage += ` Issues: ${this.processingErrors.length}.`;
        this.showStatus(finalStatusMessage, this.records.length > 0 ? 'success' : (this.processingErrors.length > 0 ? 'warning' : 'info'), this.processingErrors.length > 0 ? 7000 : 5000);

        this.populateFilterDataSources();
        this.updateCacheStatusDisplay();
        this.updateAnalysis();
    }

    getDayOfWeekNumber(dayChar) { 
        const mapping = { 'U': 0, 'M': 1, 'T': 2, 'W': 3, 'R': 4, 'F': 5, 'S': 6 };
        return mapping[String(dayChar).trim().toUpperCase()];
    }

    calculateRecurringInstancesInDateRange(metadata, filterStartDate, filterEndDate) {
        const { startRecur: metaStartRecurStr, endRecur: metaEndRecurStr, daysOfWeek: metaDaysOfWeek } = metadata;
        if (!metaStartRecurStr || !metaDaysOfWeek) return 0;

        let recurrenceStart;
        const sMetaStartRecurStr = String(metaStartRecurStr);
        const startRecurParts = sMetaStartRecurStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (startRecurParts) recurrenceStart = new Date(Date.UTC(Number(startRecurParts[1]), Number(startRecurParts[2]) - 1, Number(startRecurParts[3])));
        else { let tempDate = new Date(sMetaStartRecurStr); if (!isNaN(tempDate)) recurrenceStart = new Date(Date.UTC(tempDate.getFullYear(), tempDate.getMonth(), tempDate.getDate()));}
        if (!recurrenceStart || isNaN(recurrenceStart.getTime())) return 0;

        let recurrenceEnd = new Date(Date.UTC(9999, 11, 31));
        if (metaEndRecurStr) {
            const sMetaEndRecurStr = String(metaEndRecurStr);
            const endRecurParts = sMetaEndRecurStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (endRecurParts) recurrenceEnd = new Date(Date.UTC(Number(endRecurParts[1]), Number(endRecurParts[2]) - 1, Number(endRecurParts[3])));
            else { let tempDate = new Date(sMetaEndRecurStr); if (!isNaN(tempDate)) recurrenceEnd = new Date(Date.UTC(tempDate.getFullYear(), tempDate.getMonth(), tempDate.getDate()));}
            if (isNaN(recurrenceEnd.getTime())) recurrenceEnd = new Date(Date.UTC(9999, 11, 31));
        }
        
        let effectiveStart = new Date(recurrenceStart.getTime());
        if (filterStartDate && !isNaN(filterStartDate.getTime())) effectiveStart = new Date(Math.max(recurrenceStart.getTime(), filterStartDate.getTime()));
        let effectiveEnd = new Date(recurrenceEnd.getTime());
        if (filterEndDate && !isNaN(filterEndDate.getTime())) effectiveEnd = new Date(Math.min(recurrenceEnd.getTime(), filterEndDate.getTime()));
        if (effectiveStart > effectiveEnd) return 0;

        const targetDays = (Array.isArray(metaDaysOfWeek) ? metaDaysOfWeek : String(metaDaysOfWeek).replace(/[\[\]\s]/g, '').split(',')).map(d => this.getDayOfWeekNumber(d)).filter(d => d !== undefined);
        if (targetDays.length === 0) return 0;

        let count = 0;
        let currentDate = new Date(effectiveStart.getTime());
        while (currentDate.getTime() <= effectiveEnd.getTime()) {
            if (targetDays.includes(currentDate.getUTCDay())) count++;
            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        }
        return count;
    }

    populateFilterDataSources() {
        this.allHierarchies = [...new Set(this.records.map(r => r.hierarchy).filter(Boolean))].sort();
        this.allProjects = [...new Set(this.records.map(r => r.project).filter(Boolean))].sort();
    }
    
    isWithinDateRange(recordDateObj, filterStartDateStr, filterEndDateStr) { 
        if (!recordDateObj || isNaN(recordDateObj.getTime())) return false; 
        let filterStartDate = null;
        if (filterStartDateStr) { const [y,m,d] = filterStartDateStr.split('-').map(Number); filterStartDate = new Date(Date.UTC(y,m-1,d)); if(isNaN(filterStartDate.getTime())) filterStartDate=null;}
        let filterEndDate = null;
        if (filterEndDateStr) { const [y,m,d] = filterEndDateStr.split('-').map(Number); filterEndDate = new Date(Date.UTC(y,m-1,d)); if(isNaN(filterEndDate.getTime())) filterEndDate=null;}
        if (!filterStartDate && !filterEndDate) return true;
        return !((filterStartDate && recordDateObj < filterStartDate) || (filterEndDate && recordDateObj > filterEndDate));
    }

    getFilteredRecords() {
        const hierarchyFilter = document.getElementById('hierarchyFilterInput')?.value.trim().toLowerCase() || '';
        const projectFilter = document.getElementById('projectFilterInput')?.value.trim().toLowerCase() || '';
        
        let startDateStr = '', endDateStr = '';
        if (this.flatpickrInstance && this.flatpickrInstance.selectedDates.length === 2) {
            startDateStr = this._getISODate(this.flatpickrInstance.selectedDates[0]);
            endDateStr = this._getISODate(this.flatpickrInstance.selectedDates[1]);
        }
        
        let filterStartDate = null; if (startDateStr) { const [y,m,d] = startDateStr.split('-').map(Number); filterStartDate = new Date(Date.UTC(y,m-1,d)); if(isNaN(filterStartDate.getTime())) filterStartDate=null;}
        let filterEndDate = null; if (endDateStr) { const [y,m,d] = endDateStr.split('-').map(Number); filterEndDate = new Date(Date.UTC(y,m-1,d)); if(isNaN(filterEndDate.getTime())) filterEndDate=null;}
        
        const filteredRecs = []; let totalHours = 0; const uniqueFiles = new Set();

        for (const record of this.records) {
            if (!record) continue;
            if (hierarchyFilter && record.hierarchy && record.hierarchy.toLowerCase() !== hierarchyFilter) continue;
            if (projectFilter && record.project && record.project.toLowerCase() !== projectFilter) continue;
            
            let effectiveDuration = 0, includeRecord = false;
            if (record.metadata?.type === 'recurring') {
                if (!record.metadata.startRecur || !record.metadata.daysOfWeek || record.duration === 0) {
                    effectiveDuration = 0;
                } else {
                    const numInstances = this.calculateRecurringInstancesInDateRange(record.metadata, filterStartDate, filterEndDate);
                    effectiveDuration = (record.duration || 0) * numInstances;
                    if (effectiveDuration > 0) includeRecord = true;
                }
            } else {
                if (this.isWithinDateRange(record.date, startDateStr, endDateStr)) {
                    effectiveDuration = record.duration;
                    includeRecord = true;
                }
            }
            
            if (includeRecord && effectiveDuration > 0) {
                filteredRecs.push({ ...record, _effectiveDurationInPeriod: effectiveDuration });
                totalHours += effectiveDuration;
                uniqueFiles.add(record.path);
            }
        }
        return { records: filteredRecs, totalHours, fileCount: uniqueFiles.size, filterStartDate, filterEndDate };
    }

    aggregateForSunburst(filteredRecords, level) {
        console.log(`[TimeAnalyzer.aggregateForSunburst] Starting aggregation for level: "${level}" with ${filteredRecords.length} records.`);
        const data = {
            ids: [],
            labels: [],
            parents: [],
            values: [],
            recordsByLabel: new Map()
        };

        let innerField, outerField;
        if (level === 'project') {
            innerField = 'hierarchy';
            outerField = 'project';
        } else {
            innerField = 'project';
            outerField = 'subproject';
        }

        const uniqueEntries = new Map();
        for (const record of filteredRecords) {
            const duration = record._effectiveDurationInPeriod;
            if (typeof duration !== 'number' || isNaN(duration) || duration <= 0) continue;
            
            const innerVal = record[innerField]?.trim() || `(No ${innerField})`;
            const outerVal = record[outerField]?.trim() || `(No ${outerField})`;
            const leafId = `${innerVal} - ${outerVal}`;

            if (!uniqueEntries.has(leafId)) {
                uniqueEntries.set(leafId, { duration: 0, records: [], inner: innerVal, outer: outerVal });
            }
            uniqueEntries.get(leafId).duration += duration;
            uniqueEntries.get(leafId).records.push(record);
        }

        // --- START OF NEW, ROBUST LOGIC ---
        const parentTotals = new Map();
        let grandTotal = 0;

        // Pre-calculate totals for each parent (inner ring)
        for (const { duration, inner } of uniqueEntries.values()) {
            parentTotals.set(inner, (parentTotals.get(inner) || 0) + duration);
        }
        // Pre-calculate grand total for the root
        for (const total of parentTotals.values()) {
            grandTotal += total;
        }

        const rootId = 'Total';
        // Add root node with its pre-calculated total value
        data.ids.push(rootId);
        data.labels.push(rootId);
        data.parents.push('');
        data.values.push(grandTotal);
        data.recordsByLabel.set(rootId, filteredRecords);

        // Add parent nodes (inner ring) with their pre-calculated totals
        for (const [parent, total] of parentTotals.entries()) {
            data.ids.push(parent);
            data.labels.push(parent);
            data.parents.push(rootId);
            data.values.push(total);
            const parentRecords = filteredRecords.filter(r => (r[innerField]?.trim() || `(No ${innerField})`) === parent);
            data.recordsByLabel.set(parent, parentRecords);
        }

        // Add leaf nodes (outer ring) with their individual values
        for (const [leafId, { duration, records, inner, outer }] of uniqueEntries.entries()) {
            data.ids.push(leafId);
            data.labels.push(outer);
            data.parents.push(inner);
            data.values.push(duration);
            data.recordsByLabel.set(leafId, records);
        }
        // --- END OF NEW LOGIC ---

        console.log('[TimeAnalyzer.aggregateForSunburst] Final data for Plotly:', data);
        return data;
    }

    aggregateForPieChart(filteredData, level, pattern = null) {
        const { records: filteredRecords } = filteredData; 
        const hours = new Map(), recordsByCategory = new Map();
        let regex = null, aggregationError = false;

        if (pattern?.trim()) {
            try { regex = new RegExp(pattern.trim(), 'i'); } 
            catch (e) { this.showStatus(`Invalid Pie Regex: ${e.message}`, 'error'); aggregationError = true; return { hours, recordsByCategory, error: aggregationError }; }
        }

        for (const record of filteredRecords) {
            const key = record[level] != null ? String(record[level]) : `(No ${level} defined)`;
            if (regex && !regex.test(key)) continue;
            if (record._effectiveDurationInPeriod <= 0) continue;

            hours.set(key, (hours.get(key) || 0) + record._effectiveDurationInPeriod);
            if (!recordsByCategory.has(key)) recordsByCategory.set(key, []);
            recordsByCategory.get(key).push(record);
        }
        return { hours, recordsByCategory, error: aggregationError };
    }

    renderPieChartDisplay(hoursData) { 
        const mainChartEl = document.getElementById('mainChart');
        if (!mainChartEl) return;
        const levelSelect = document.getElementById('levelSelect_pie');
        const chartTitleText = levelSelect ? levelSelect.selectedOptions[0].text.split('(')[0].trim() : 'Category';
        const data = [{
            type: 'pie',
            labels: Array.from(hoursData.keys()),
            values: Array.from(hoursData.values()),
            textinfo: 'label+percent',
            textposition: 'outside',
            hoverinfo: 'label+value+percent',
            automargin: true,
            marker: { line: { color: 'white', width: 2 } }
        }];
        const layout = {
            title: { text: `Time Distribution by ${chartTitleText}`, font: { size: 18, color: '#2d3748' } },
            font: { family: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif' },
            showlegend: true,
            legend: { orientation: 'v', x: 1.05, y: 0.5 }, 
            margin: { t: 50, b: 20, l: 20, r: 20 },
            height: 500 
        };
        Plotly.newPlot(mainChartEl, data, layout, { responsive: true, displayModeBar: true, modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'] });
        
        mainChartEl.removeAllListeners('plotly_click'); 
        mainChartEl.on('plotly_click', (eventData) => {
            if (eventData.points && eventData.points.length > 0) {
                const categoryName = eventData.points[0].label;
                if (this.currentPieAggregatedData && this.currentPieAggregatedData.recordsByCategory && this.currentPieAggregatedData.recordsByCategory.has(categoryName)) {
                    this.showDetailPopup(categoryName, this.currentPieAggregatedData.recordsByCategory.get(categoryName), { type: 'pie', value: eventData.points[0].value });
                }
            }
        });
    }

    updateAnalysis() {
        console.log('[TimeAnalyzer.updateAnalysis] Updating analysis...');
        const statsGrid = document.getElementById('statsGrid');
        const mainChartContainer = document.getElementById('mainChartContainer');
        const errorLogContainer = document.getElementById('errorLogContainer');
        const mainChartEl = document.getElementById('mainChart');
        const legendEl = document.getElementById('customLegend'); // Get legend element

        Plotly.purge(mainChartEl); 

        const hideUIElements = () => {
            if (statsGrid) statsGrid.style.display = 'none';
            if (mainChartContainer) mainChartContainer.style.display = 'none';
            if (legendEl) legendEl.style.display = 'none'; // Also hide the legend panel
            if (errorLogContainer && this.processingErrors.length === 0 && this.records.length === 0) {
                 errorLogContainer.style.display = 'none'; // Only hide if truly empty
            }
            document.getElementById('currentAnalysisTypeStat').textContent = "N/A";
        };
        
        if (this.records.length === 0 && this.processingErrors.length === 0) {
            hideUIElements();
            this.saveUIState();
            return;
        }

        if (this.loadingToast) this.hideSpecificToast(this.loadingToast);
        this.loadingToast = this.showStatus(`<span class="loading"></span> Updating analysis...`, 'info-persistent');
        
        setTimeout(() => { 
            this.renderErrorLog(); // Always render log
            const filteredDataResults = this.getFilteredRecords();
            this.filteredRecordsForCharts = filteredDataResults.records; 

            if (this.loadingToast) { this.hideSpecificToast(this.loadingToast); this.loadingToast = null; }

            if (this.filteredRecordsForCharts.length === 0 && this.records.length > 0) {
                 this.showStatus('No data matches current filters.', 'info', 3000);
            }
            
            if (this.filteredRecordsForCharts.length === 0) { // If no data AT ALL after filtering
                 hideUIElements();
                 this.saveUIState();
                 return;
            }
            
            // Show UI elements if there's data
            if (statsGrid) statsGrid.style.display = '';
            if (mainChartContainer) mainChartContainer.style.display = '';
            if (errorLogContainer) errorLogContainer.style.display = 'block'; // Ensure log is visible if there are errors or data
            
            document.getElementById('totalHours').textContent = filteredDataResults.totalHours.toFixed(2);
            document.getElementById('totalFiles').textContent = filteredDataResults.fileCount;
            
            const analysisType = document.getElementById('analysisTypeSelect').value;
            const analysisTypeStatEl = document.getElementById('currentAnalysisTypeStat');
            let analysisName = "Unknown"; // Default

            if (analysisType === 'sunburst') {
                analysisName = "Category Breakdown";
                if (legendEl) legendEl.style.display = ''; // SHOW legend for sunburst charts

                const sunburstLevel = document.getElementById('levelSelect').value;
                const pattern = document.getElementById('patternInput').value;
                
                let recordsForSunburst = filteredDataResults.records;
                
                // Apply category filter to the records before aggregation
                if (pattern?.trim()) {
                    try {
                        const regex = new RegExp(pattern.trim(), 'i');
                        const outerField = sunburstLevel === 'project' ? 'project' : 'subproject';
                        recordsForSunburst = filteredDataResults.records.filter(record => {
                            const outerValue = record[outerField] || '';
                            return regex.test(outerValue);
                        });
                    } catch (e) {
                        mainChartEl.innerHTML = `<p class="chart-message error">Invalid Regex: ${e.message}</p>`;
                        this.showStatus(`Invalid Category Filter Regex: ${e.message}`, 'error');
                        if (legendEl) legendEl.innerHTML = ''; // Clear legend on error
                        return; // Stop processing for this analysis
                    }
                }

                this.currentSunburstAggregatedData = this.aggregateForSunburst(recordsForSunburst, sunburstLevel);

                if (this.currentSunburstAggregatedData && this.currentSunburstAggregatedData.ids.length > 1) { // more than just the root
                    this.renderSunburstChartDisplay(this.currentSunburstAggregatedData);
                } else if (pattern?.trim() && recordsForSunburst.length === 0) {
                    mainChartEl.innerHTML = '<p class="chart-message">No data matches the Category Filter.</p>';
                    if (legendEl) legendEl.innerHTML = ''; // Also clear legend content
                } else {
                    mainChartEl.innerHTML = '<p class="chart-message">No data for Sunburst Chart with current filters.</p>';
                    if (legendEl) legendEl.innerHTML = ''; // Also clear legend content
                }
            } else { // This block handles time-series and activity patterns
                if (legendEl) legendEl.style.display = 'none'; // HIDE legend for all other chart types

                if (analysisType === 'time-series') {
                    analysisName = "Time-Series Trend";
                    this.renderTimeSeriesChart();
                } else if (analysisType === 'activity') {
                    analysisName = "Activity Patterns";
                    this.renderActivityPatternChart();
                } else if (analysisType === 'pie') {
                    analysisName = "Category Breakdown";
                    const pieLevel = document.getElementById('levelSelect_pie').value;
                    const piePattern = document.getElementById('patternInput').value;
                    this.currentPieAggregatedData = this.aggregateForPieChart(filteredDataResults, pieLevel, piePattern);
                    if (!this.currentPieAggregatedData.error && this.currentPieAggregatedData.hours.size > 0) {
                        this.renderPieChartDisplay(this.currentPieAggregatedData.hours);
                    } else if (this.currentPieAggregatedData.error) {
                        mainChartEl.innerHTML = '<p class="chart-message error">Error in Pie Chart regex pattern.</p>';
                    } else {
                        mainChartEl.innerHTML = '<p class="chart-message">No data for Pie Chart with current filters.</p>';
                    }
                }
            }

            analysisTypeStatEl.textContent = analysisName;
            this.saveUIState(); 
            console.log('[TimeAnalyzer.updateAnalysis] Analysis update complete.');
        }, 50); 
    }

    renderSunburstChartDisplay(sunburstData) {
        const mainChartEl = document.getElementById('mainChart');
        const legendEl = document.getElementById('customLegend');
        if (!mainChartEl || !legendEl) return;

        const initialTrace = {
            type: 'sunburst',
            ids: sunburstData.ids,
            labels: sunburstData.labels,
            parents: sunburstData.parents,
            values: sunburstData.values,
            branchvalues: 'total',
            level: 1,
            textinfo: 'none',
            hoverinfo: 'label+percent parent+value',
            marker: {
                line: { color: 'white', width: 2 }
            },
        };

        const layout = {
            font: { family: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif' },
            margin: { t: 10, b: 10, l: 10, r: 10 },
            height: 470,
        };
        
        Plotly.react(mainChartEl, [initialTrace], layout, { responsive: true, displayModeBar: true, modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'] })
        .then(gd => {
            legendEl.innerHTML = '';
            const levelSelectValue = document.getElementById('levelSelect').value;
            let innerTitle, outerTitle;
            if (levelSelectValue === 'project') { innerTitle = 'Hierarchies'; outerTitle = 'Projects'; }
            else { outerTitle = 'Sub-projects'; innerTitle = 'Projects'; }

            const rootId = 'Total';
            const innerRingIds = sunburstData.ids.filter(id => sunburstData.parents[sunburstData.ids.indexOf(id)] === rootId);

            // This is our single, reliable source of truth for colors.
            const originalColorsMap = new Map();
            if (gd.calcdata && gd.calcdata[0]) {
                gd.calcdata[0].forEach(point => {
                    if (point.id && typeof point.color === 'string' && point.color.length > 0) {
                        originalColorsMap.set(point.id, point.color);
                    }
                });
            } else {
                console.error('Plotly calcdata is missing!');
                return;
            }
            
            // Set initial colors just for the first render. We will NOT reuse this array.
            initialTrace.marker.colors = sunburstData.ids.map(id => originalColorsMap.get(id) || '#ccc');


            // Legend building logic
            const createLegendSection = (title, ids, isOuterRing = false) => {
                const sectionDiv = document.createElement('div'); sectionDiv.className = 'legend-section';
                sectionDiv.innerHTML = `<div class="legend-title">${title}</div>`;
                const sortedIds = [...ids].sort((a, b) => sunburstData.labels[sunburstData.ids.indexOf(a)].localeCompare(sunburstData.labels[sunburstData.ids.indexOf(b)]));
                sortedIds.forEach(id => {
                    const index = sunburstData.ids.indexOf(id); const label = sunburstData.labels[index];
                    const parentId = sunburstData.parents[index]; const grandTotal = sunburstData.values[sunburstData.ids.indexOf(rootId)];
                    const itemDiv = document.createElement('div'); itemDiv.className = 'legend-item'; itemDiv.dataset.id = id;
                    const colorBox = document.createElement('div'); colorBox.className = 'legend-color-box';
                    const colorKey = isOuterRing ? parentId : id; 
                    colorBox.style.backgroundColor = originalColorsMap.get(colorKey) || '#ccc';
                    itemDiv.innerHTML = `<span class="legend-label" title="${label}">${label}</span><span class="legend-value">${grandTotal > 0 ? (sunburstData.values[index] / grandTotal * 100).toFixed(1) + '%' : '0.0%'}</span>`;
                    itemDiv.prepend(colorBox); sectionDiv.appendChild(itemDiv);
                });
                return sectionDiv;
            };
            legendEl.appendChild(createLegendSection(innerTitle, innerRingIds));
            const outerRingIds = sunburstData.ids.filter(id => innerRingIds.includes(sunburstData.parents[sunburstData.ids.indexOf(id)]));
            legendEl.appendChild(createLegendSection(outerTitle, outerRingIds, true));

            let highlightedId = null;
            const allLegendItems = legendEl.querySelectorAll('.legend-item');

            allLegendItems.forEach(item => {
                item.addEventListener('click', () => {
                    const idToHighlight = item.dataset.id;
                    highlightedId = (highlightedId === idToHighlight) ? null : idToHighlight;

                    allLegendItems.forEach(legendItem => {
                        legendItem.classList.toggle('legend-item-active', legendItem.dataset.id === highlightedId);
                    });

                    const traceForUpdate = { marker: {} }; // We only need to update the colors.

                    if (highlightedId) {
                        const branchIds = new Set([highlightedId]);
                        const findDescendants = (parentId) => {
                            sunburstData.ids.forEach((id, i) => {
                                if (sunburstData.parents[i] === parentId) {
                                    branchIds.add(id);
                                    findDescendants(id);
                                }
                            });
                        };
                        findDescendants(highlightedId);

                        // *** THE DEFINITIVE FIX: Generate colors from scratch on every click ***
                        traceForUpdate.marker.colors = sunburstData.ids.map(id => {
                            // 1. Get the original color directly from our reliable map.
                            const baseColor = originalColorsMap.get(id) || '#ccc';

                            // 2. Check if this ID should be highlighted.
                            if (branchIds.has(id)) {
                                return baseColor; // Use the full, original color.
                            } else {
                                // 3. Otherwise, make it transparent. This code now cannot fail.
                                const colorObj = Plotly.d3.color(baseColor);
                                if (colorObj) {
                                    colorObj.opacity = 0.2;
                                    return colorObj.toString();
                                }
                                return 'rgba(204, 204, 204, 0.2)'; // Failsafe
                            }
                        });
                    } else {
                        // If nothing is highlighted, reset to the original colors.
                        traceForUpdate.marker.colors = sunburstData.ids.map(id => originalColorsMap.get(id) || '#ccc');
                    }
                    
                    // Use Plotly.restyle to efficiently update just the colors of the existing chart.
                    Plotly.restyle(mainChartEl, traceForUpdate);
                });
            });

            gd.on('plotly_sunburstclick', (eventData) => {
                if (eventData.points && eventData.points.length > 0) {
                    const point = eventData.points[0];
                    if (point.id && point.id !== rootId) {
                        if (this.currentSunburstAggregatedData && this.currentSunburstAggregatedData.recordsByLabel.has(point.id)) {
                            this.showDetailPopup(point.label, this.currentSunburstAggregatedData.recordsByLabel.get(point.id), { type: 'sunburst', value: point.value });
                        }
                    }
                }
                return false;
            });
        });
    }



    renderErrorLog() {
        const errorLogContainer = document.getElementById('errorLogContainer');
        const errorLogSummary = document.getElementById('errorLogSummary');
        const errorLogEntries = document.getElementById('errorLogEntries');
        if (!errorLogContainer || !errorLogSummary || !errorLogEntries) return;

        errorLogEntries.innerHTML = ''; 
        if (this.processingErrors.length === 0) {
            errorLogSummary.textContent = 'No processing issues found for the last selected folder.';
            errorLogContainer.style.display = (this.records.length > 0 || this.cache.size > 0 || this.processingErrors.length > 0) ? 'block' : 'none';
            return;
        }
        errorLogSummary.textContent = `Found ${this.processingErrors.length} issue(s) during file processing:`;
        this.processingErrors.forEach(err => {
            const details = document.createElement('details'); details.className = 'log-entry';
            const summary = document.createElement('summary'); summary.textContent = `⚠️ ${err.file || 'Unknown File'}`;
            const content = document.createElement('div'); content.className = 'log-entry-content';
            content.innerHTML = `<strong>Path:</strong> ${err.path || 'N/A'}<br><strong>Reason:</strong> ${err.reason || 'No specific reason provided.'}`;
            details.appendChild(summary); details.appendChild(content); errorLogEntries.appendChild(details);
        });
        errorLogContainer.style.display = 'block';
    }

    showDetailPopup(categoryName, recordsList, context = {}) { // categoryName is the main identifier for the popup title
        const popupTitleEl = document.getElementById('popupTitle');
        const popupSummaryStatsEl = document.getElementById('popupSummaryStats');
        const tableBody = document.getElementById('popupTableBody');
        const detailOverlay = document.getElementById('detailOverlay');
        const detailPopup = document.getElementById('detailPopup');
        if (!popupTitleEl || !popupSummaryStatsEl || !tableBody || !detailOverlay || !detailPopup) return;

        popupTitleEl.textContent = `Details for: ${categoryName}`;
        
        const numSourceFiles = new Set(recordsList.map(r => r.path)).size;
        let displayTotalHours = 0;
        if (context && context.value !== undefined) {
            displayTotalHours = parseFloat(context.value);
        } else { // Fallback if no direct context value
            displayTotalHours = recordsList.reduce((sum, r) => sum + (r._effectiveDurationInPeriod || 0), 0);
        }
        const avgDurationPerFile = numSourceFiles > 0 ? (displayTotalHours / numSourceFiles) : 0;

        let totalHoursLabel = "Total Hours";
        if (context.type === 'sunburst') totalHoursLabel = "Total Hrs (Category)";
        else if (context.type === 'time-series') totalHoursLabel = "Total Hrs (Period)";
        else if (context.type === 'activity') totalHoursLabel = "Total Hrs (Activity)";
        
        popupSummaryStatsEl.innerHTML = `
            <div class="summary-stat"><div class="summary-stat-value">${numSourceFiles}</div><div class="summary-stat-label">Unique Files</div></div>
            <div class="summary-stat"><div class="summary-stat-value">${displayTotalHours.toFixed(2)}</div><div class="summary-stat-label">${totalHoursLabel}</div></div>
            <div class="summary-stat"><div class="summary-stat-value">${avgDurationPerFile.toFixed(2)}</div><div class="summary-stat-label">Avg. Hrs/File</div></div>`;
        
        tableBody.innerHTML = ''; 
        const { filterStartDate, filterEndDate } = this.getFilteredRecords(); 
        const uniqueFileRecords = new Map();
        recordsList.forEach(rec => { if (!uniqueFileRecords.has(rec.path)) uniqueFileRecords.set(rec.path, rec); });

        Array.from(uniqueFileRecords.values()).sort((a, b) => {
            const dateA = a.date instanceof Date ? a.date.getTime() : null;
            const dateB = b.date instanceof Date ? b.date.getTime() : null;
            if (dateA && dateB) return dateB - dateA; 
            if (dateA) return -1; if (dateB) return 1;  
            return (a.path || "").localeCompare(b.path || ""); 
        }).forEach(record => {
            const row = tableBody.insertRow();
            row.insertCell().innerHTML = `<span class="file-path-cell" title="${record.path || ''}">${record.path || 'N/A'}</span>`;
            const dateCell = row.insertCell(); dateCell.className = 'date-cell'; 
            if (record.date instanceof Date && !isNaN(record.date.getTime())) dateCell.textContent = this._getISODate(record.date);
            else if (record.metadata?.type === 'recurring') dateCell.textContent = 'Recurring';
            else dateCell.textContent = 'N/A';
            
            let displayDurationInRow = record.duration || 0; 
            if (record.metadata?.type === 'recurring') {
                // For recurring, show total duration within the *global* filter range for this item
                const numInstances = this.calculateRecurringInstancesInDateRange(record.metadata, filterStartDate, filterEndDate);
                displayDurationInRow = (record.duration || 0) * numInstances; 
            } else {
                // For non-recurring, _effectiveDurationInPeriod is already calculated for the global filter
                displayDurationInRow = record._effectiveDurationInPeriod || 0;
            }
            const durationCell = row.insertCell(); durationCell.className = 'duration-cell'; 
            durationCell.textContent = displayDurationInRow.toFixed(2);
            row.insertCell().className = 'project-cell'; row.cells[3].textContent = record.project || 'N/A';
            row.insertCell().className = 'subproject-cell'; row.cells[4].textContent = record.subprojectFull || 'N/A';
        });
        detailOverlay.classList.add('visible'); detailPopup.classList.add('visible');
        document.body.style.overflow = 'hidden'; 
    }

    hideDetailPopup() {
        document.getElementById('detailOverlay')?.classList.remove('visible');
        document.getElementById('detailPopup')?.classList.remove('visible');
        document.body.style.overflow = ''; 
    }

    renderTimeSeriesChart() {
        const mainChartEl = document.getElementById('mainChart');
        if (!mainChartEl) return;
        Plotly.purge(mainChartEl); 
        if (!this.filteredRecordsForCharts || this.filteredRecordsForCharts.length === 0) {
            mainChartEl.innerHTML = '<p class="chart-message">No data available for Time-Series chart with current filters.</p>';
            return;
        }

        const granularity = document.getElementById('timeSeriesGranularitySelect').value;
        const chartType = document.getElementById('timeSeriesTypeSelect').value;
        const stackingLevel = document.getElementById('timeSeriesStackingLevelSelect').value; 
        const { filterStartDate, filterEndDate } = this.getFilteredRecords(); 
        const dataByPeriod = new Map();

        this.filteredRecordsForCharts.forEach(record => {
            if (record.metadata?.type === 'recurring') {
                const { startRecur, endRecur, daysOfWeek } = record.metadata;
                if (!startRecur || !daysOfWeek || record.duration === 0) return;

                let recStart = new Date(this._getISODate(new Date(startRecur)));
                let recEnd = endRecur ? new Date(this._getISODate(new Date(endRecur))) : new Date(Date.UTC(9999, 0, 1));
                const actualDays = (Array.isArray(daysOfWeek) ? daysOfWeek : String(daysOfWeek).replace(/[\[\]\s]/g, '').split(',')).map(d => this.getDayOfWeekNumber(d)).filter(d => d !== undefined);
                
                let iterDate = new Date(Math.max(recStart.getTime(), (filterStartDate ? filterStartDate.getTime() : recStart.getTime())));
                let maxDate = new Date(Math.min(recEnd.getTime(), (filterEndDate ? filterEndDate.getTime() : recEnd.getTime())));

                while (iterDate <= maxDate) {
                    if (actualDays.includes(iterDate.getUTCDay())) {
                        let periodKey;
                        if (granularity === 'daily') periodKey = this._getISODate(iterDate);
                        else if (granularity === 'weekly') periodKey = this._getISODate(this._getWeekStartDate(iterDate));
                        else periodKey = this._getISODate(this._getMonthStartDate(iterDate));

                        if (!dataByPeriod.has(periodKey)) dataByPeriod.set(periodKey, { total: 0, categories: {} });
                        dataByPeriod.get(periodKey).total += record.duration; 
                        if (chartType === 'stackedArea') {
                            const category = record[stackingLevel] || `(No ${stackingLevel} defined)`;
                            dataByPeriod.get(periodKey).categories[category] = (dataByPeriod.get(periodKey).categories[category] || 0) + record.duration;
                        }
                    }
                    iterDate.setUTCDate(iterDate.getUTCDate() + 1);
                }
            } else { 
                if (!record.date || isNaN(record.date.getTime())) return; 
                let periodKey;
                if (granularity === 'daily') periodKey = this._getISODate(record.date);
                else if (granularity === 'weekly') periodKey = this._getISODate(this._getWeekStartDate(record.date));
                else periodKey = this._getISODate(this._getMonthStartDate(record.date));

                if (!dataByPeriod.has(periodKey)) dataByPeriod.set(periodKey, { total: 0, categories: {} });
                // For non-recurring, _effectiveDurationInPeriod is already the correct duration for the filtered range
                dataByPeriod.get(periodKey).total += record._effectiveDurationInPeriod; 
                if (chartType === 'stackedArea') {
                    const category = record[stackingLevel] || `(No ${stackingLevel} defined)`;
                    dataByPeriod.get(periodKey).categories[category] = (dataByPeriod.get(periodKey).categories[category] || 0) + record._effectiveDurationInPeriod;
                }
            }
        });

        const sortedPeriods = Array.from(dataByPeriod.keys()).sort((a, b) => new Date(a) - new Date(b));
        const traces = [];

        if (sortedPeriods.length === 0) {
            mainChartEl.innerHTML = '<p class="chart-message">No data points to plot for Time-Series with current filters.</p>';
            return;
        }

        if (chartType === 'line') {
            traces.push({ x: sortedPeriods, y: sortedPeriods.map(p => dataByPeriod.get(p).total.toFixed(2)), type: 'scatter', mode: 'lines+markers', name: 'Total Hours' });
        } else { 
            const allCategories = new Set();
            sortedPeriods.forEach(p => Object.keys(dataByPeriod.get(p).categories).forEach(cat => allCategories.add(cat)));
            Array.from(allCategories).sort().forEach(category => {
                traces.push({ x: sortedPeriods, y: sortedPeriods.map(p => (dataByPeriod.get(p).categories[category] || 0).toFixed(2)), type: 'scatter', mode: 'lines', stackgroup: 'one', name: category, hoverinfo: 'x+y+name' });
            });
        }
        
        if (traces.length === 0) {
            mainChartEl.innerHTML = '<p class="chart-message">No data series to plot for Time-Series.</p>';
            return;
        }
        const layout = {
            title: `Time Spent (${granularity}) - ${chartType === 'line' ? 'Overall Trend' : `Stacked by ${stackingLevel.charAt(0).toUpperCase() + stackingLevel.slice(1)}`}`,
            xaxis: { title: 'Period', type: 'date' }, yaxis: { title: 'Hours' },
            height: 500, margin: { t: 50, b: 80, l: 60, r: 30 }, hovermode: 'x unified'
        };
        Plotly.newPlot(mainChartEl, traces, layout, { responsive: true });

        // Add click listener for bar charts (if applicable, mainly for 'line' if represented as bars or 'stackedArea')
        mainChartEl.removeAllListeners('plotly_click');
        mainChartEl.on('plotly_click', (eventData) => {
            if (eventData.points && eventData.points.length > 0) {
                const point = eventData.points[0];
                const periodClicked = point.x; // Date string for the period
                
                // Need to filter `this.filteredRecordsForCharts` for records contributing to this `periodClicked`
                const recordsForPopup = this.filteredRecordsForCharts.filter(record => {
                    if (record.metadata?.type === 'recurring') {
                        const { startRecur, endRecur, daysOfWeek } = record.metadata;
                        if (!startRecur || !daysOfWeek) return false;
                        let recStart = new Date(this._getISODate(new Date(startRecur)));
                        let recEnd = endRecur ? new Date(this._getISODate(new Date(endRecur))) : new Date(Date.UTC(9999,0,1));
                        const actualDays = (Array.isArray(daysOfWeek) ? daysOfWeek : String(daysOfWeek).replace(/[\[\]\s]/g, '').split(','))
                            .map(d => this.getDayOfWeekNumber(d)).filter(d => d !== undefined);

                        let iterDate = new Date(Math.max(recStart.getTime(), (filterStartDate ? filterStartDate.getTime() : recStart.getTime())));
                        let maxDate = new Date(Math.min(recEnd.getTime(), (filterEndDate ? filterEndDate.getTime() : recEnd.getTime())));

                        while(iterDate <= maxDate) {
                            if (actualDays.includes(iterDate.getUTCDay())) {
                                let currentPeriodKey;
                                if (granularity === 'daily') currentPeriodKey = this._getISODate(iterDate);
                                else if (granularity === 'weekly') currentPeriodKey = this._getISODate(this._getWeekStartDate(iterDate));
                                else currentPeriodKey = this._getISODate(this._getMonthStartDate(iterDate));
                                if (currentPeriodKey === periodClicked) return true;
                            }
                            iterDate.setUTCDate(iterDate.getUTCDate() + 1);
                        }
                        return false;
                    } else { // Non-recurring
                        if (!record.date || isNaN(record.date.getTime())) return false;
                        let recordPeriodKey;
                        if (granularity === 'daily') recordPeriodKey = this._getISODate(record.date);
                        else if (granularity === 'weekly') recordPeriodKey = this._getISODate(this._getWeekStartDate(record.date));
                        else recordPeriodKey = this._getISODate(this._getMonthStartDate(record.date));
                        return recordPeriodKey === periodClicked;
                    }
                });

                if (recordsForPopup.length > 0) {
                    const categoryNameForPopup = `Period: ${periodClicked} (${granularity})`;
                    let clickedValue = point.y;
                    // For stacked charts, point.y is the individual segment. We want the total for that period.
                    // However, if it's a line chart, point.y is the total.
                    // If stacked, point.data.name is the category, point.fullData.name is also category.
                    // The context.value should be the total sum for that period if easily available,
                    // or the specific segment value if that's more relevant.
                    // For simplicity, let's use the specific segment's value (point.y) for stacked, and total for line.
                    // The showDetailPopup will sum from recordsForPopup if context.value is not perfectly representative.
                    this.showDetailPopup(categoryNameForPopup, recordsForPopup, { type: 'time-series', value: clickedValue });
                }
            }
        });
    }

    renderActivityPatternChart() {
        const mainChartEl = document.getElementById('mainChart');
        if (!mainChartEl) return;
        Plotly.purge(mainChartEl); 
        if (!this.filteredRecordsForCharts || this.filteredRecordsForCharts.length === 0) {
            mainChartEl.innerHTML = '<p class="chart-message">No data available for Activity Patterns with current filters.</p>';
            return;
        }

        const patternType = document.getElementById('activityPatternTypeSelect').value;
        const records = this.filteredRecordsForCharts; 
        const { filterStartDate, filterEndDate } = this.getFilteredRecords(); // Get global filters
        let data, layout, plotType = 'bar';
        const daysOfWeekLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const hourLabels = Array.from({ length: 24 }, (_, i) => `${i}`); // 0-23

        if (patternType === 'dayOfWeek') {
            const hoursByDay = Array(7).fill(0);
            records.forEach(record => {
                if (record.metadata?.type === 'recurring') {
                    const { startRecur, endRecur, daysOfWeek } = record.metadata;
                    if (!startRecur || !daysOfWeek || record.duration === 0) return;
                    let recStart = new Date(this._getISODate(new Date(startRecur)));
                    let recEnd = endRecur ? new Date(this._getISODate(new Date(endRecur))) : new Date(Date.UTC(9999, 0, 1));
                    const actualDays = (Array.isArray(daysOfWeek) ? daysOfWeek : String(daysOfWeek).replace(/[\[\]\s]/g, '').split(',')).map(d => this.getDayOfWeekNumber(d)).filter(d => d !== undefined);
                    let iterDate = new Date(Math.max(recStart.getTime(), (filterStartDate ? filterStartDate.getTime() : recStart.getTime())));
                    let maxDate = new Date(Math.min(recEnd.getTime(), (filterEndDate ? filterEndDate.getTime() : recEnd.getTime())));
                    while (iterDate <= maxDate) {
                        const dayIndex = iterDate.getUTCDay(); 
                        if (actualDays.includes(dayIndex)) hoursByDay[dayIndex] += record.duration; // Use base duration, as _effective already sums up
                        iterDate.setUTCDate(iterDate.getUTCDate() + 1);
                    }
                } else { 
                    if (record.date && !isNaN(record.date.getTime())) {
                        const dayIndex = record.date.getUTCDay(); 
                        hoursByDay[dayIndex] += record._effectiveDurationInPeriod;
                    }
                }
            });
            data = [{ x: daysOfWeekLabels, y: hoursByDay.map(h => h.toFixed(2)), type: 'bar' }];
            layout = { title: 'Total Hours by Day of Week', yaxis: { title: 'Hours' }, height: 500 };
        } else if (patternType === 'hourOfDay') {
            const hoursByHour = Array(24).fill(0);
            records.forEach(record => {
                const startHour = record.metadata?.startTime ? this._getHourFromTimeStr(record.metadata.startTime) : null;
                if (startHour !== null) {
                     // _effectiveDurationInPeriod is the total duration of the record within the global filter.
                     // This sums all occurrences of a recurring event, or the single duration of a non-recurring one.
                     // If we want to attribute this total to the start hour, this is correct.
                    hoursByHour[startHour] += record._effectiveDurationInPeriod; 
                }
            });
            data = [{ x: hourLabels, y: hoursByHour.map(h => h.toFixed(2)), type: 'bar' }];
            layout = { title: 'Total Hours by Task Start Hour', xaxis: { title: 'Hour of Day (0-23)' }, yaxis: { title: 'Hours' }, height: 500 };
        } else if (patternType === 'heatmapDOWvsHOD') {
            const heatmapData = Array(7).fill(null).map(() => Array(24).fill(0)); 
            records.forEach(record => {
                const startHour = record.metadata?.startTime ? this._getHourFromTimeStr(record.metadata.startTime) : null;
                if (startHour === null) return;

                if (record.metadata?.type === 'recurring') {
                    const { startRecur, endRecur, daysOfWeek } = record.metadata;
                    if (!startRecur || !daysOfWeek || record.duration === 0) return; // Use base duration
                    let recStart = new Date(this._getISODate(new Date(startRecur)));
                    let recEnd = endRecur ? new Date(this._getISODate(new Date(endRecur))) : new Date(Date.UTC(9999, 0, 1));
                    const actualDays = (Array.isArray(daysOfWeek) ? daysOfWeek : String(daysOfWeek).replace(/[\[\]\s]/g, '').split(',')).map(d => this.getDayOfWeekNumber(d)).filter(d => d !== undefined);
                    
                    let iterDate = new Date(Math.max(recStart.getTime(), (filterStartDate ? filterStartDate.getTime() : recStart.getTime())));
                    let maxDate = new Date(Math.min(recEnd.getTime(), (filterEndDate ? filterEndDate.getTime() : recEnd.getTime())));
                    
                    while (iterDate <= maxDate) {
                        const dayIndex = iterDate.getUTCDay();
                        if (actualDays.includes(dayIndex)) {
                            heatmapData[dayIndex][startHour] += record.duration; // Add base duration for each instance
                        }
                        iterDate.setUTCDate(iterDate.getUTCDate() + 1);
                    }
                } else { 
                    if (record.date && !isNaN(record.date.getTime())) {
                        const dayIndex = record.date.getUTCDay(); 
                        heatmapData[dayIndex][startHour] += record._effectiveDurationInPeriod; // This is the already filtered duration
                    }
                }
            });
            data = [{ z: heatmapData.map(row => row.map(val => val > 0 ? val.toFixed(2) : null)), x: hourLabels, y: daysOfWeekLabels, type: 'heatmap', colorscale: 'Viridis', hoverongaps: false }];
            layout = { title: 'Activity Heatmap (Day of Week vs Task Start Hour)', xaxis: { title: 'Hour of Day (0-23)' }, height: 500 };
            plotType = 'heatmap';
        }

        if (!data || (plotType === 'bar' && data[0].y.every(val => parseFloat(val) === 0)) || (plotType === 'heatmap' && data[0].z.flat().every(val => val === null))) {
            const analysisTypeName = document.getElementById('activityPatternTypeSelect').selectedOptions[0].text;
            mainChartEl.innerHTML = `<p class="chart-message">No data to plot for ${analysisTypeName}.</p>`;
            return;
        }
        Plotly.newPlot(mainChartEl, data, layout, { responsive: true });

        mainChartEl.removeAllListeners('plotly_click'); // Clear previous listeners
        
        if (plotType === 'bar') {
            mainChartEl.on('plotly_click', (eventData) => {
                if (eventData.points && eventData.points.length > 0) {
                    const point = eventData.points[0];
                    const categoryClicked = point.x; // Day name or Hour string
                    let recordsForPopup = [];

                    if (patternType === 'dayOfWeek') {
                        const dayIndexClicked = daysOfWeekLabels.indexOf(categoryClicked);
                        if (dayIndexClicked === -1) return;
                        recordsForPopup = this.filteredRecordsForCharts.filter(record => {
                            if (record.metadata?.type === 'recurring') {
                                const { startRecur, endRecur, daysOfWeek: metaDaysOfWeek } = record.metadata;
                                if (!startRecur || !metaDaysOfWeek) return false;
                                const actualDays = (Array.isArray(metaDaysOfWeek) ? metaDaysOfWeek : String(metaDaysOfWeek).replace(/[\[\]\s]/g, '').split(','))
                                    .map(d => this.getDayOfWeekNumber(d)).filter(d => d !== undefined);
                                if (!actualDays.includes(dayIndexClicked)) return false;

                                let recStart = new Date(this._getISODate(new Date(startRecur)));
                                let recEnd = endRecur ? new Date(this._getISODate(new Date(endRecur))) : new Date(Date.UTC(9999,0,1));
                                let iterDate = new Date(Math.max(recStart.getTime(), (filterStartDate ? filterStartDate.getTime() : recStart.getTime())));
                                let maxDate = new Date(Math.min(recEnd.getTime(), (filterEndDate ? filterEndDate.getTime() : recEnd.getTime())));
                                while(iterDate <= maxDate) {
                                    if (iterDate.getUTCDay() === dayIndexClicked) return true; // At least one instance falls on this day
                                    iterDate.setUTCDate(iterDate.getUTCDate() + 1);
                                }
                                return false;
                            } else { // Non-recurring
                                return record.date && !isNaN(record.date.getTime()) && record.date.getUTCDay() === dayIndexClicked;
                            }
                        });
                    } else if (patternType === 'hourOfDay') {
                        const hourClicked = parseInt(categoryClicked, 10);
                        if (isNaN(hourClicked)) return;
                        recordsForPopup = this.filteredRecordsForCharts.filter(record => {
                            const startHour = record.metadata?.startTime ? this._getHourFromTimeStr(record.metadata.startTime) : null;
                            return startHour === hourClicked;
                        });
                    }

                    if (recordsForPopup.length > 0) {
                        const categoryNameForPopup = `${categoryClicked} (${patternType === 'dayOfWeek' ? 'Day' : 'Start Hour'})`;
                        this.showDetailPopup(categoryNameForPopup, recordsForPopup, { type: 'activity', value: parseFloat(point.y), category: categoryClicked });
                    }
                }
            });
        } else if (plotType === 'heatmap') {
            mainChartEl.on('plotly_click', (eventData) => {
                if (eventData.points && eventData.points.length > 0) {
                    const point = eventData.points[0];
                    const clickedHourStr = point.x; // Hour string e.g. "14"
                    const clickedDayLabel = point.y; // Day label e.g. "Monday"
                    const clickedValue = parseFloat(point.z); // Value in the cell

                    if (clickedValue === null || isNaN(clickedValue) || clickedValue === 0) return; // No data in this cell

                    const clickedHour = parseInt(clickedHourStr, 10);
                    const clickedDayIndex = daysOfWeekLabels.indexOf(clickedDayLabel);

                    if (isNaN(clickedHour) || clickedDayIndex === -1) return;

                    let recordsForPopup = this.filteredRecordsForCharts.filter(record => {
                        const recordStartHour = record.metadata?.startTime ? this._getHourFromTimeStr(record.metadata.startTime) : null;
                        if (recordStartHour !== clickedHour) return false;

                        if (record.metadata?.type === 'recurring') {
                            const { startRecur, endRecur, daysOfWeek: metaDaysOfWeek } = record.metadata;
                            if (!startRecur || !metaDaysOfWeek) return false;
                            
                            const actualDays = (Array.isArray(metaDaysOfWeek) ? metaDaysOfWeek : String(metaDaysOfWeek).replace(/[\[\]\s]/g, '').split(','))
                                .map(d => this.getDayOfWeekNumber(d)).filter(d => d !== undefined);
                            if (!actualDays.includes(clickedDayIndex)) return false; // Must be one of the recurring days

                            // Check if any instance *within the global filter range* falls on the clickedDayIndex
                            let recStart = new Date(this._getISODate(new Date(startRecur)));
                            let recEnd = endRecur ? new Date(this._getISODate(new Date(endRecur))) : new Date(Date.UTC(9999,0,1));
                            let iterDate = new Date(Math.max(recStart.getTime(), (filterStartDate ? filterStartDate.getTime() : recStart.getTime())));
                            let maxDate = new Date(Math.min(recEnd.getTime(), (filterEndDate ? filterEndDate.getTime() : recEnd.getTime())));
                            
                            let instanceOnClickedDay = false;
                            while(iterDate <= maxDate) {
                                if (iterDate.getUTCDay() === clickedDayIndex) {
                                    instanceOnClickedDay = true;
                                    break;
                                }
                                iterDate.setUTCDate(iterDate.getUTCDate() + 1);
                            }
                            return instanceOnClickedDay;
                        } else { // Non-recurring
                            return record.date && !isNaN(record.date.getTime()) && record.date.getUTCDay() === clickedDayIndex;
                        }
                    });
                    
                    if (recordsForPopup.length > 0) {
                        const nextHour = (clickedHour + 1) % 24;
                        const categoryNameForPopup = `Activity: ${clickedDayLabel}, ${String(clickedHour).padStart(2, '0')}:00 - ${String(nextHour).padStart(2, '0')}:00`;
                        this.showDetailPopup(categoryNameForPopup, recordsForPopup, { type: 'activity-heatmap', value: clickedValue, category: `${clickedDayLabel} ${clickedHourStr}h` });
                    }
                }
            });
        }
    }
} // End of TimeAnalyzer class

document.addEventListener('DOMContentLoaded', () => { window.timeAnalyzerApp = new TimeAnalyzer(); });