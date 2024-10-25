let activeHandleKeyPress = null;

// =======================
// Helper Functions
// =======================

/**
 * Capitalizes the first letter of a given string.
 * @param {string} string - The string to capitalize.
 * @returns {string} - The capitalized string.
 */
function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Converts RGB values to a hexadecimal color string.
 * @param {number} r - Red component (0-255).
 * @param {number} g - Green component (0-255).
 * @param {number} b - Blue component (0-255).
 * @returns {string} - Hexadecimal color string.
 */
function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Parses a color string to extract RGBA components.
 * @param {string} str - The color string to parse.
 * @returns {object|null} - An object with r, g, b, a properties or null if parsing fails.
 */
function parseSettingColor(str) {
  const regex = /new\s+SettingColor\(\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\s*\)?/;
  const match = str.match(regex);
  if (match) {
    const r = parseInt(match[1], 10);
    const g = parseInt(match[2], 10);
    const b = parseInt(match[3], 10);
    const a = parseInt(match[4], 10);
    return { r, g, b, a };
  }
  return null;
}

/**
 * Checks if a keybind is already in use across all keybind buttons.
 * @param {string} key - The key to check.
 * @returns {boolean} - True if the key is in use, false otherwise.
 */
function isKeybindInUse(key) {
  const allKeybindButtons = document.querySelectorAll('.keybind-button');
  for (const button of allKeybindButtons) {
    if (button.textContent.toUpperCase() === key) {
      return true;
    }
  }
  return false;
}

// =======================
// Data Fetching
// =======================

/**
 * Fetches data from the 'modules.json' file.
 * @returns {Promise<object|null>} - The parsed JSON data or null if an error occurs.
 */
async function fetchData() {
  try {
    const response = await fetch('modules.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching data from modules.json:', error);
    return null;
  }
}

// =======================
// GUI Display
// =======================

/**
 * Displays the GUI
 */
async function displayGUI() {
  const guiDiv = document.getElementById('gui');


  guiDiv.innerHTML = '<p>Loading categories...</p>';
  const data = await fetchData();

  if (!data) {
    guiDiv.innerHTML = '<p>Error loading data.</p>';
    return;
  }

  guiDiv.innerHTML = '';

  data.forEach(category => {
    const { name: categoryName, modules } = category;

    console.log(`Processing category: ${categoryName}`);

    const categoryDiv = document.createElement('div');
    categoryDiv.className = 'category';

    const categoryHeader = document.createElement('h3');
    categoryHeader.textContent = capitalizeFirstLetter(categoryName);
    categoryHeader.classList.add('category-text');

    categoryHeader.addEventListener('click', () => { // collapse / expand the entire category
      const modules = categoryDiv.querySelectorAll('.module');
      modules.forEach(module => {
        module.style.display = module.style.display === 'none' ? 'block' : 'none';
      });
    });

    // Prevent default context menu on category header
    categoryHeader.addEventListener('contextmenu', event => {
      event.preventDefault();
    });

    categoryDiv.appendChild(categoryHeader);

    modules.forEach(module => {
      console.log(`Adding module: ${module.name}`);
      const moduleDiv = document.createElement('div');
      moduleDiv.className = 'module';

      // Create separate elements for title and description
      const moduleTitle = document.createElement('div');
      moduleTitle.className = 'module-title module-text';
      moduleTitle.textContent = module.title || module.name;

      const moduleDescription = document.createElement('div');
      moduleDescription.className = 'module-description module-text';
      moduleDescription.textContent = module.description || '';

      moduleDiv.appendChild(moduleTitle);
      moduleDiv.appendChild(moduleDescription);

      moduleTitle.classList.add('module-title-text'); // UI customization
      moduleDescription.classList.add('module-description-text');

      moduleDiv.addEventListener('contextmenu', event => { // collapse/expand a module
        event.preventDefault(); // Prevent the default context menu from appearing
        console.log(`Right-clicked on module: ${module.name}`);
        showModuleSettings(module, moduleDiv);
      });

      categoryDiv.appendChild(moduleDiv);
    });

    guiDiv.appendChild(categoryDiv);
  });
}

// =======================
// Module Settings
// =======================

/**
 * Displays the settings for a specific module.
 * @param {object} module - The module data.
 * @param {HTMLElement} moduleDiv - The module's DOM element.
 */
function showModuleSettings(module, moduleDiv) {
  let settingsDiv = moduleDiv.querySelector('.settings');

  if (!settingsDiv) {
    settingsDiv = document.createElement('div');
    settingsDiv.className = 'settings collapsed';
    moduleDiv.appendChild(settingsDiv);

    settingsDiv.addEventListener('contextmenu', event => {
      event.stopPropagation();
    });
  }

  if (settingsDiv.getAttribute('data-loaded') === 'true') { // once loaded just toggle between
    settingsDiv.classList.toggle('collapsed');
    settingsDiv.classList.toggle('expanded');
    return;
  }

  settingsDiv.innerHTML = '';

  const settings = module.settings;

  if (settings && settings.length > 0) {
    const settingsByGroup = settings.reduce((groups, setting) => { // group settings
      const group = setting.groupName || 'Default';
      if (!groups[group]) groups[group] = [];
      groups[group].push(setting);
      return groups;
    }, {});

    for (const [groupName, groupSettings] of Object.entries(settingsByGroup)) { // loop through setting groups
      
      const groupContainer = document.createElement('div'); // group container
      groupContainer.className = 'setting-group';
      settingsDiv.appendChild(groupContainer);

      const groupHeader = document.createElement('h4'); // group header
      groupHeader.textContent = groupName;
      groupHeader.className = 'setting-group-header setting-group-header-text';

      groupHeader.addEventListener('contextmenu', event => { event.preventDefault(); });

      groupContainer.appendChild(groupHeader);

      const groupContent = document.createElement('div'); // group settings container
      groupContent.className = 'group-content';
      groupContainer.appendChild(groupContent);

      groupSettings.forEach(setting => { // populate settings
        const settingElement = document.createElement('div');
        settingElement.className = 'setting setting-row';

        let inputElement;
        const labelElement = document.createElement('label');
        labelElement.textContent =
          capitalizeFirstLetter(setting.displayName || setting.variableName || 'Unnamed Setting');
        labelElement.classList.add('setting-title-text');

        const descriptionElement = document.createElement('small');
        descriptionElement.textContent = setting.description || '';
        descriptionElement.classList.add('setting-description-text');

        const settingType = setting.builderType || setting.type || 'Unknown';

        switch (settingType) {
          case 'Enum':
            if (Array.isArray(setting.options) && setting.options.length > 0) {
              inputElement = document.createElement('select');
              setting.options.forEach(option => {
                const optionElement = document.createElement('option');
                optionElement.value = option;
                optionElement.textContent = option;
                if (option === setting.defaultValue) {
                  optionElement.selected = true;
                }
                inputElement.appendChild(optionElement);
              });
            } else { // fallback if no options are listed
              inputElement = document.createElement('input');
              inputElement.type = 'text';
              inputElement.value = setting.defaultValue || '';
            }
            settingElement.appendChild(labelElement);
            settingElement.appendChild(inputElement);
            settingElement.appendChild(descriptionElement);
            break;

          case 'Boolean':
            inputElement = document.createElement('input');
            inputElement.type = 'checkbox';
            inputElement.checked = String(setting.defaultValue).toLowerCase() === 'true';
            inputElement.id = `${module.name}-${setting.variableName}`; // Unique ID for label association
            labelElement.setAttribute('for', inputElement.id); // associate label to checkbox

            const checkboxContainer = document.createElement('div'); // container for checkbox + label
            checkboxContainer.className = 'checkbox-container';
            checkboxContainer.appendChild(inputElement);
            checkboxContainer.appendChild(labelElement);

            settingElement.appendChild(checkboxContainer);
            settingElement.appendChild(descriptionElement);
            break;

          case 'Integer':
          case 'Double':
            inputElement = document.createElement('input');
            inputElement.type = 'range';
            inputElement.value = setting.defaultValue || 0;

            const isDouble = settingType === 'Double'; // default / fallback values
            const defaultStep = isDouble ? '0.1' : '1';

            inputElement.min = setting.min != null ? setting.min : 0;
            inputElement.max = setting.max != null ? setting.max : setting.defaultValue || 100;
            inputElement.step = setting.step != null ? setting.step : defaultStep;

            const valueDisplay = document.createElement('span'); // current value
            valueDisplay.textContent = inputElement.value;

            inputElement.addEventListener('input', () => { // update
              valueDisplay.textContent = inputElement.value;
            });

            settingElement.appendChild(labelElement);
            settingElement.appendChild(inputElement);
            settingElement.appendChild(valueDisplay);
            settingElement.appendChild(descriptionElement);
            break;

          case 'Color':
            inputElement = document.createElement('input');
            inputElement.type = 'color';
            let hexColor = '#ffffff';
            // parse the default color -> hex
            if (typeof setting.defaultValue === 'object') {
              const { r, g, b } = setting.defaultValue;
              hexColor = rgbToHex(r, g, b);
            } else if (typeof setting.defaultValue === 'string') {
              const colorObj = parseSettingColor(setting.defaultValue);
              if (colorObj) hexColor = rgbToHex(colorObj.r, colorObj.g, colorObj.b);
            }

            inputElement.value = hexColor;
            settingElement.appendChild(labelElement);
            settingElement.appendChild(inputElement);
            settingElement.appendChild(descriptionElement);
            break;

          case 'Keybind': // dummy keybind button
            const keybindContainer = document.createElement('div');
            keybindContainer.className = 'keybind-container';

            const keybindButton = document.createElement('button');
            keybindButton.type = 'button';
            keybindButton.className = 'keybind-button';
            keybindButton.textContent = setting.value || 'Set Keybind';
            keybindButton.dataset.module = module.name;
            keybindButton.dataset.setting = setting.variableName;

            keybindButton.addEventListener('click', () => {
              openKeybindPopup(setting, keybindButton);
            });

            keybindContainer.appendChild(labelElement);
            keybindContainer.appendChild(keybindButton);
            keybindContainer.appendChild(descriptionElement);

            settingElement.appendChild(keybindContainer);
            break;

          default: // fallback to text input
            inputElement = document.createElement('input');
            inputElement.type = 'text';
            inputElement.value = setting.defaultValue || '';
            settingElement.appendChild(labelElement);
            settingElement.appendChild(inputElement);
            settingElement.appendChild(descriptionElement);
            break;
        }

        groupContent.appendChild(settingElement);
      });

      groupContent.classList.remove('collapsed');
    }
  } else {
    settingsDiv.textContent = 'No settings found.';
  }

  settingsDiv.setAttribute('data-loaded', 'true'); // mark as loaded
  settingsDiv.classList.remove('collapsed'); // expand
  settingsDiv.classList.add('expanded');
}

// =======================
// Settings Popup
// =======================

/**
 * Opens the settings popup and applies saved custom colors.
 */
function openSettingsPopup() {
  loadCustomColors(); // Ensure saved options are applied
  document.getElementById('settings-popup').style.display = 'flex'; // Use flex for layout
  document.getElementById('overlay').style.display = 'block';
}

/**
 * Closes the settings popup and overlay.
 */
function closeSettingsPopup() {
  document.getElementById('settings-popup').style.display = 'none';
  document.getElementById('overlay').style.display = 'none';
}

/**
 * Applies custom colors and chroma effects based on user selections.
 */
function applyCustomColors() {
  const backgroundColor = document.getElementById('background-color').value;
  const categoryColor = document.getElementById('category-color').value;
  const moduleColor = document.getElementById('module-color').value;

  const categoryTextColor = document.getElementById('category-text-color').value;
  const moduleTextColor = document.getElementById('module-text-color').value;
  const settingTitleTextColor = document.getElementById('setting-title-text-color').value;
  const settingDescriptionTextColor = document.getElementById('setting-description-text-color').value;
  const settingGroupHeaderTextColor = document.getElementById('setting-group-header-text-color').value;

  const chromaEnabled = document.getElementById('enable-chroma').checked;

  const chromaOptions = {
    categoryText: document.getElementById('chroma-category-text').checked,
    moduleTitleText: document.getElementById('chroma-module-title-text').checked,
    moduleDescriptionText: document.getElementById('chroma-module-description-text').checked,
    settingTitle: document.getElementById('chroma-setting-title').checked,
    settingDescription: document.getElementById('chroma-setting-description').checked,
    settingGroupHeader: document.getElementById('chroma-setting-group-header').checked,
    categoryBackground: document.getElementById('chroma-category-background').checked,
    moduleBackground: document.getElementById('chroma-module-background').checked
  };

  // Save settings to local storage
  const settings = {
    backgroundColor,
    categoryColor,
    moduleColor,
    categoryTextColor,
    moduleTextColor,
    settingTitleTextColor,
    settingDescriptionTextColor,
    settingGroupHeaderTextColor,
    chromaEnabled,
    chromaOptions
  };
  localStorage.setItem('customColors', JSON.stringify(settings));

  // Apply the colors and chroma options
  applySettings(settings);
}

/**
 * Applies the given settings to the GUI elements.
 * @param {object} settings - The settings to apply.
 */
function applySettings(settings) {
  // Apply colors to the GUI elements
  document.body.style.backgroundColor = settings.backgroundColor;
  document.querySelectorAll('.category').forEach(el => { el.style.backgroundColor = settings.categoryColor; });
  document.querySelectorAll('.module').forEach(el => { el.style.backgroundColor = settings.moduleColor; });
  document.querySelectorAll('.category-text').forEach(el => { el.style.color = settings.categoryTextColor; });
  document.querySelectorAll('.module-text').forEach(el => { el.style.color = settings.moduleTextColor; });
  document.querySelectorAll('.setting-title-text').forEach(el => { el.style.color = settings.settingTitleTextColor; });
  document.querySelectorAll('.setting-description-text').forEach(el => { el.style.color = settings.settingDescriptionTextColor; });
  document.querySelectorAll('.setting-group-header-text').forEach(el => { el.style.color = settings.settingGroupHeaderTextColor; });

  if (settings.chromaEnabled) {
    document.getElementById('chroma-options').style.display = 'block';
    applyChromaOptions(settings.chromaOptions);
  } else {
    document.getElementById('chroma-options').style.display = 'none';
    resetChromaOptions();
  }
}

/**
 * Applies chroma effect classes based on user selections.
 * @param {object} options - The chroma options to apply.
 */
function applyChromaOptions(options) {
  const chromaClassMap = {
    categoryText: 'chroma-category-text',
    moduleTitleText: 'chroma-module-title-text',
    moduleDescriptionText: 'chroma-module-description-text',
    settingTitle: 'chroma-setting-title',
    settingDescription: 'chroma-setting-description',
    settingGroupHeader: 'chroma-setting-group-header',
    categoryBackground: 'chroma-category-background',
    moduleBackground: 'chroma-module-background'
  };

  const selectorMap = {
    categoryText: '.category-text',
    moduleTitleText: '.module-title-text',
    moduleDescriptionText: '.module-description-text',
    settingTitle: '.setting-title-text',
    settingDescription: '.setting-description-text',
    settingGroupHeader: '.setting-group-header-text',
    categoryBackground: '.category',
    moduleBackground: '.module'
  };

  for (const [key, isEnabled] of Object.entries(options)) {
    const className = chromaClassMap[key];
    const selector = selectorMap[key];

    if (!className || !selector) continue; // Skip if mapping is missing

    document.querySelectorAll(selector).forEach(el => {
      if (isEnabled) {
        el.classList.add(className); // Apply chroma class
      } else {
        el.classList.remove(className); // Remove chroma class
        el.style.animation = ''; // Stop any ongoing animation
      }
    });
  }
}

/**
 * Resets all chroma options, removing related classes and animations.
 */
function resetChromaOptions() {
  const chromaClassPattern = /\bchroma-\S+/g;
  const chromaElements = document.querySelectorAll('[class*="chroma-"]');

  chromaElements.forEach(el => {
    el.className = el.className.replace(chromaClassPattern, '').trim(); // Remove chroma classes
    el.style.animation = ''; // Clear any inline animation styles
  });

  document.querySelectorAll('#chroma-options input[type="checkbox"]').forEach(checkbox => {
    checkbox.checked = false; // Reset checkboxes
  });
}

/**
 * Restores the settings form inputs based on saved settings.
 * @param {object} settings - The settings to restore.
 */
function restoreSettingsForm(settings) {
  // Restore input values in the settings menu
  document.getElementById('background-color').value = settings.backgroundColor;
  document.getElementById('category-color').value = settings.categoryColor;
  document.getElementById('module-color').value = settings.moduleColor;

  document.getElementById('category-text-color').value = settings.categoryTextColor;
  document.getElementById('module-text-color').value = settings.moduleTextColor;
  document.getElementById('setting-title-text-color').value = settings.settingTitleTextColor;
  document.getElementById('setting-description-text-color').value = settings.settingDescriptionTextColor;
  document.getElementById('setting-group-header-text-color').value = settings.settingGroupHeaderTextColor;

  // Restore chroma checkbox values
  document.getElementById('enable-chroma').checked = settings.chromaEnabled;

  for (const [key, value] of Object.entries(settings.chromaOptions)) {
    const elementId = `chroma-${key.replace(/[A-Z]/g, '-$&').toLowerCase()}`;
    const checkbox = document.getElementById(elementId);
    if (checkbox) checkbox.checked = value;
  }
}

/**
 * Loads custom colors from localStorage and applies them.
 */
function loadCustomColors() {
  const savedSettings = localStorage.getItem('customColors');
  if (savedSettings) {
    const settings = JSON.parse(savedSettings);
    applySettings(settings); // Apply settings to the GUI
    restoreSettingsForm(settings); // Restore values to the form inputs
  }
}

// =======================
// Chroma Toggle Handling
// =======================

/**
 * Handles the toggling of chroma effects based on user interaction.
 */
function handleChromaToggle() {
  const chromaCheckbox = document.getElementById('enable-chroma');
  const chromaOptionsDiv = document.getElementById('chroma-options');

  chromaCheckbox.addEventListener('change', () => {
    if (chromaCheckbox.checked) {
      chromaOptionsDiv.style.display = 'block';
    } else {
      chromaOptionsDiv.style.display = 'none';

      chromaOptionsDiv.querySelectorAll('input[type="checkbox"]').forEach(checkbox => { checkbox.checked = false; });

      const chromaClassPattern = /\bchroma-\S+/g; // remove & stop animations
      document.querySelectorAll('[class*="chroma-"]').forEach(el => {
        el.className = el.className.replace(chromaClassPattern, '').trim();
        el.style.animation = '';
      });
    }
  });
}

// =======================
// Keybind Popup Handling
// =======================

/**
 * Creates the Keybind Popup and Bound Confirmation Popup overlays.
 */
function createKeybindPopup() {
  // Prevent creating multiple overlays
  if (document.getElementById('keybind-popup-overlay')) return;

  const keybindOverlay = document.createElement('div');
  keybindOverlay.id = 'keybind-popup-overlay';
  keybindOverlay.style.display = 'none';

  const keybindPopup = document.createElement('div');
  keybindPopup.id = 'keybind-popup';

  const keybindMessage = document.createElement('p');
  keybindMessage.textContent = 'Press any key to set the keybind...';
  keybindPopup.appendChild(keybindMessage);

  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Cancel';
  cancelButton.className = 'keybind-cancel-button';
  cancelButton.addEventListener('click', closeKeybindPopup);
  keybindPopup.appendChild(cancelButton);

  keybindOverlay.appendChild(keybindPopup);
  document.body.appendChild(keybindOverlay);

  const boundOverlay = document.createElement('div');
  boundOverlay.id = 'bound-popup-overlay';
  boundOverlay.style.display = 'none';

  const boundPopup = document.createElement('div');
  boundPopup.id = 'bound-popup';

  const boundMessage = document.createElement('p');
  boundMessage.id = 'bound-message';
  boundMessage.textContent = 'Bound to (keyname)';
  boundPopup.appendChild(boundMessage);

  const okButton = document.createElement('button');
  okButton.textContent = 'OK';
  okButton.className = 'bound-ok-button';
  okButton.addEventListener('click', () => {  boundOverlay.style.display = 'none'; });
  boundPopup.appendChild(okButton);

  boundOverlay.appendChild(boundPopup);
  document.body.appendChild(boundOverlay);
}

/**
 * Opens the Keybind Popup and sets up keypress handling.
 * @param {object} setting - The setting object to update.
 * @param {HTMLElement} buttonElement - The button element to update with the keybind.
 */
function openKeybindPopup(setting, buttonElement) {
  createKeybindPopup(); // Ensure popup exists

  const overlay = document.getElementById('keybind-popup-overlay');
  overlay.style.display = 'flex';

  /**
   * Handles the keypress event for setting a keybind.
   * @param {KeyboardEvent} event - The keydown event.
   */
  function handleKeyPress(event) {
    event.preventDefault();
    const key = event.key.toUpperCase();

    if (isKeybindInUse(key)) {
      alert(`The key "${key}" is already in use. Please choose a different keybind.`);
      return;
    }

    setting.value = key;
    buttonElement.textContent = key;

    document.removeEventListener('keydown', handleKeyPress); // Remove the event listener and close the popup
    activeHandleKeyPress = null; // Clear the global reference
    closeKeybindPopup();

    const boundOverlay = document.getElementById('bound-popup-overlay'); // show confirmation
    const boundMessage = document.getElementById('bound-message');
    boundMessage.textContent = `Bound to "${key}"`;
    boundOverlay.style.display = 'flex';
  }

  activeHandleKeyPress = handleKeyPress; // assign global ref + event listener
  document.addEventListener('keydown', handleKeyPress);
}

/**
 * Closes the Keybind Popup and removes any lingering event listeners.
 */
function closeKeybindPopup() {
  const overlay = document.getElementById('keybind-popup-overlay');
  if (overlay) {
    overlay.style.display = 'none';

    // Remove any lingering keydown listeners
    if (activeHandleKeyPress) {
      document.removeEventListener('keydown', activeHandleKeyPress);
      activeHandleKeyPress = null; // Clear the global reference
    }
  }
}

// =======================
// Settings Management
// =======================

/**
 * Resets all settings to their default values.
 */
function resetSettings() {
  const defaultSettings = {
    backgroundColor: '#1e1e1e',
    categoryColor: '#2c2c2c',
    moduleColor: '#3a3a3a',
    categoryTextColor: '#ffffff',
    moduleTextColor: '#e0e0e0',
    settingTitleTextColor: '#ffffff',
    settingDescriptionTextColor: '#aaaaaa',
    settingGroupHeaderTextColor: '#ffffff',
    chromaEnabled: false,
    chromaOptions: {
      categoryText: false,
      moduleTitleText: false,
      moduleDescriptionText: false,
      settingTitle: false,
      settingDescription: false,
      settingGroupHeader: false,
      categoryBackground: false,
      moduleBackground: false,
    }
  };

  localStorage.setItem('customColors', JSON.stringify(defaultSettings)); // reset saved settings
  applySettings(defaultSettings); // apply defaults
  restoreSettingsForm(defaultSettings);
  resetChromaOptions();
}

// =======================
// Initialization
// =======================


window.addEventListener('load', async () => {
  await displayGUI();
  handleChromaToggle();
  loadCustomColors();
  closeSettingsPopup();

  // Event listeners for settings popup actions
  document.getElementById('settings-btn').addEventListener('click', openSettingsPopup);
  document.getElementById('reset-settings').addEventListener('click', resetSettings);
  document.getElementById('close-popup').addEventListener('click', closeSettingsPopup);
  document.getElementById('apply-colors').addEventListener('click', () => { applyCustomColors(); });
  document.getElementById('overlay').addEventListener('click', closeSettingsPopup); // close settings popup when clicking outside
});
