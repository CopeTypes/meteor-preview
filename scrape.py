import re, time, json, requests

# GitHub repository details
GITHUB_API_BASE = 'https://api.github.com/repos/MeteorDevelopment/meteor-client/contents/src/main/java/meteordevelopment/meteorclient/systems/modules'

# Headers for requests
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/vnd.github.v3+json'
}

def fetch_categories(): # get the list of categories
    url = GITHUB_API_BASE
    response = requests.get(url, headers=HEADERS)
    response.raise_for_status()
    data = response.json()
    categories = [item for item in data if item['type'] == 'dir']
    return categories

def fetch_modules(category_path): # get the list of modules from a category
    url = f'https://api.github.com/repos/MeteorDevelopment/meteor-client/contents/{category_path}'
    response = requests.get(url, headers=HEADERS)
    response.raise_for_status()
    data = response.json()
    modules = [item for item in data if item['type'] == 'file' and item['name'].endswith('.java')]
    return modules

def fetch_module_content(download_url):
    response = requests.get(download_url, headers=HEADERS)
    response.raise_for_status()
    return response.text

def parse_settings(module_content): # parse the settings from a module
    settings = []

    group_display_names = {} # match setting groups
    group_regex = re.compile(
        r'(?:private|protected)\s+final\s+SettingGroup\s+(\w+)\s*=\s*settings\.(?:getDefaultGroup\(\)|createGroup\(\s*"([^"]+)"\s*\));'
    )
    group_matches = group_regex.findall(module_content)
    for group_var_name, group_display_name in group_matches:
        group_display_names[group_var_name] = group_display_name or 'Default'

    
    setting_regex = re.compile( # match settings
        r'(?:public|private|protected)\s+final\s+Setting<([^>]+)>\s+(\w+)\s*=\s*(\w+)\s*\.\s*add\(\s*(?:new\s+[\w<>.]+\.Builder[\s\S]+?\.build\(\))\s*\);'
    )
    setting_matches = setting_regex.findall(module_content)

    for setting_type, variable_name, group_var_name in setting_matches:
        # Extract the setting builder block
        pattern = re.escape(variable_name) + r'\s*=\s*' + re.escape(group_var_name) + r'\s*\.\s*add\(\s*([\s\S]+?)\);'
        setting_block_match = re.search(pattern, module_content)
        setting_block = setting_block_match.group(1) if setting_block_match else ''

        # Extract display name
        name_match = re.search(r'\.name\(\s*"([^"]+)"\s*\)', setting_block)
        display_name = name_match.group(1) if name_match else 'Unnamed Setting'

        # Extract description
        description_match = re.search(r'\.description\(\s*"([^"]+)"\s*\)', setting_block)
        description = description_match.group(1) if description_match else ''

        # Extract default value
        default_value_match = re.search(r'\.defaultValue\(\s*([^)]+?)\s*\)', setting_block)
        default_value = default_value_match.group(1).strip() if default_value_match else ''
        default_value = default_value.strip('"')

        # Determine builder type
        if 'new EnumSetting.Builder' in setting_block:
            builder_type = 'Enum'
        elif 'new BoolSetting.Builder' in setting_block:
            builder_type = 'Boolean'
        elif 'new IntSetting.Builder' in setting_block:
            builder_type = 'Integer'
        elif 'new DoubleSetting.Builder' in setting_block:
            builder_type = 'Double'
        elif 'new ColorSetting.Builder' in setting_block:
            builder_type = 'Color'
        elif 'new KeybindSetting.Builder' in setting_block:
            builder_type = 'Keybind'
        else:
            builder_type = 'Unknown'

        
        options = []
        if builder_type == 'Enum':
            enum_type = setting_type
            predefined_enums = {
                'Safety': ['Safe', 'Suicide'],
                'SortPriority': ['LowestDistance', 'HighestDistance', 'LowestHealth', 'HighestHealth', 'ClosestAngle'],
                'ShapeMode': ['Lines', 'Sides', 'Both'],
                'Hand': ['MainHand', 'OffHand'],
                'Target': ['Head', 'Body', 'Feet'],
                'Nuker.Mode': ['All', 'Flatten', 'Smash'], # i'm not sure why these aren't getting detected from the module content, but not a big deal.
                'Nuker.SortMode': ['None', 'Closest', 'Furthest', 'TopDown']
            }
            if enum_type in predefined_enums:
                options = predefined_enums[enum_type]
            else:
                enum_regex = re.compile(r'enum\s+' + re.escape(enum_type) + r'\s*\{([\s\S]*?)\}', re.DOTALL) # match enums
                enum_match = enum_regex.search(module_content)
                if enum_match:
                    enum_body = enum_match.group(1)
                    enum_constants_part = enum_body.split(';')[0]
                    
                    def split_enum_constants(s): # copiage
                        constants = []
                        current = ''
                        depth = 0
                        i = 0
                        while i < len(s):
                            c = s[i]
                            if c == '(':
                                depth += 1
                            elif c == ')':
                                depth -= 1
                            elif c == ',' and depth == 0:
                                constants.append(current.strip())
                                current = ''
                                i += 1
                                continue
                            current += c
                            i += 1
                        if current.strip():
                            constants.append(current.strip())
                        return constants

                    enum_constants = split_enum_constants(enum_constants_part)

                    options = [opt.split('(')[0].strip() for opt in enum_constants]
                else:
                    print(f'Enum type {enum_type} not found in module or predefined.')
                    options = []

        min_value = None
        max_value = None
        step_value = None

        if builder_type in ['Integer', 'Double']: # extract min, max, and step
            
            # todo need to handle sliderMin
            range_match = re.search(r'\.range\(\s*([^\s,]+)\s*,\s*([^\)]+)\s*\)', setting_block)
            if range_match: # match for range first
                min_value, max_value = range_match.groups()
            else: # fallback to min & max
                min_match = re.search(r'\.min\(\s*([^)]+?)\s*\)', setting_block)
                if min_match:
                    min_value = min_match.group(1).strip()
                max_match = re.search(r'\.max\(\s*([^)]+?)\s*\)', setting_block)
                if max_match:
                    max_value = max_match.group(1).strip()
                else: # check for slider max
                    slider_max_match = re.search(r'\.sliderMax\(\s*([^)]+?)\s*\)', setting_block)
                    if slider_max_match:
                        max_value = slider_max_match.group(1).strip()

            step_match = re.search(r'\.(?:step|slider)\(\s*([^)]+?)\s*\)', setting_block) # match step
            if step_match:
                step_value = step_match.group(1).strip()
            else:
                # Sometimes step is specified via .decimalPlaces(int)
                if builder_type == 'Double':
                    decimal_places_match = re.search(r'\.decimalPlaces\(\s*(\d+)\s*\)', setting_block)
                    if decimal_places_match:
                        decimal_places = decimal_places_match.group(1).strip()
                        # Convert decimal places to step value (e.g., decimal places of 2 corresponds to step of 0.01)
                        try:
                            decimal_places_int = int(decimal_places)
                            if decimal_places_int > 0:
                                step_value = '0.' + '0' * (decimal_places_int - 1) + '1'
                        except ValueError:
                            step_value = 0.1
                    else:
                        step_value = 0.1 # default step if not declared by the module

        group_display_name = group_display_names.get(group_var_name, group_var_name) or 'Default'

        settings.append({
            'variableName': variable_name,
            'displayName': display_name,
            'description': description,
            'defaultValue': default_value,
            'type': setting_type,
            'builderType': builder_type,
            'options': options,
            'groupName': group_display_name,
            'min': min_value,
            'max': max_value,
            'step': step_value
        })

    return settings




def main():
    all_data = []

    print('Fetching categories...')
    categories = fetch_categories()

    for category in categories:
        category_name = category['name']
        category_path = category['path']

        print(f'Processing category: {category_name}')
        modules = fetch_modules(category_path)
        print(f'Got {len(modules)} modules')
        
        category_data = { 'name': category_name,'modules': []}

        for module in modules:
            module_name = module['name'].replace('.java', '')
            download_url = module['download_url']
            print(f'Processing module: {module_name}')

            module_content = fetch_module_content(download_url)
            settings = parse_settings(module_content)

            module_data = {'name': module_name, 'settings': settings}

            category_data['modules'].append(module_data)
            time.sleep(0.2)

        all_data.append(category_data)

        time.sleep(0.2)

    with open('modules.json', 'w', encoding='utf-8') as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)

    print('Saved to modules.json')

if __name__ == '__main__':
    main()
