__doc__ = '''
Builds documentation docs form .md frontmatter.
'''
__author__ = 'YouFoundJK'

import os
import re
import html # For escaping potentially problematic characters in Markdown if needed

# --- Configuration (Default) ---
MARKDOWN_FILE_PATH = "documentation_content.md"  # Your source Markdown file
TEMPLATE_FILE_PATH = "documentation_template.html" # The HTML template
OUTPUT_FILE_PATH = "documentation.html"          # The final, distributable HTML file

# The exact HTML comment placeholder in your template where Markdown will be injected.
# Make sure this matches the comment inside the <script id="markdown-source"> tag.
MARKDOWN_PLACEHOLDER_COMMENT = "<!-- MARKDOWN CONTENT WILL BE INSERTED HERE BY THE BUILD SCRIPT -->"

def main():
    """
    Reads Markdown content, injects it into an HTML template, and saves the result.
    """
    print(f"Starting documentation build...")
    print(f"Reading Markdown from: {MARKDOWN_FILE_PATH}")

    try:
        with open(MARKDOWN_FILE_PATH, "r", encoding="utf-8") as md_file:
            markdown_content = md_file.read()
    except FileNotFoundError:
        print(f"ERROR: Markdown file not found at '{MARKDOWN_FILE_PATH}'. Aborting.")
        return
    except Exception as e:
        print(f"ERROR: Could not read Markdown file: {e}. Aborting.")
        return

    print(f"Reading HTML template from: {TEMPLATE_FILE_PATH}")
    try:
        with open(TEMPLATE_FILE_PATH, "r", encoding="utf-8") as tmpl_file:
            template_html = tmpl_file.read()
    except FileNotFoundError:
        print(f"ERROR: HTML template file not found at '{TEMPLATE_FILE_PATH}'. Aborting.")
        return
    except Exception as e:
        print(f"ERROR: Could not read HTML template file: {e}. Aborting.")
        return

    # --- Inject Markdown into the <script id="markdown-source"> tag ---
    # We need to be careful here to replace only the content of the script tag.
    # The script tag itself should remain.

    # It's crucial that the Markdown content itself doesn't contain a literal `</script>` tag
    # that isn't part of a fenced code block. If it does, it will prematurely close
    # our #markdown-source script tag.
    # A simple way to mitigate this for display purposes (if such a string must appear in text):
    if "</script>" in markdown_content.lower():
        print("WARNING: The string '</script>' was found in your Markdown content.")
        print("         This can break the HTML structure if not handled carefully.")
        print("         Consider escaping it or ensuring it's within a fenced code block.")
        # For a more robust solution, one might escape it:
        # markdown_content = markdown_content.replace("</script>", "<\\/script>")
        # Or, more safely, ensure marked.js handles this during parsing or avoid such literal strings.

    # Using regex to find the script tag and replace its content (the placeholder comment)
    # This is more robust than simple string replacement if the placeholder might have whitespace variations.
    # Regex: (<script type="text/markdown" id="markdown-source"[^>]*>)\s*COMMENT\s*(</script>)
    # Captures:
    #   Group 1: The opening script tag (e.g., <script type="text/markdown" id="markdown-source" style="display:none;">)
    #   Group 2: The closing script tag (</script>)
    # We then replace the content between these two groups.

    script_tag_pattern = re.compile(
        r'(<script\s+type="text/markdown"\s+id="markdown-source"[^>]*>)'  # Group 1: Opening tag
        r'\s*' + re.escape(MARKDOWN_PLACEHOLDER_COMMENT) + r'\s*'  # The placeholder comment, allowing whitespace around it
        r'(</script>)',  # Group 2: Closing tag
        re.DOTALL | re.IGNORECASE # DOTALL for multi-line comments, IGNORECASE for attributes
    )

    # Replacement function: takes the match object and returns the new string
    def replace_script_content(match):
        opening_tag = match.group(1)
        closing_tag = match.group(2)
        # Important: Escape HTML special characters in markdown_content if it's being placed directly
        # into HTML context where it could be misinterpreted. Since it's inside a <script type="text/markdown">,
        # direct HTML interpretation is less of a concern, but for safety if it were elsewhere:
        # escaped_markdown_content = html.escape(markdown_content)
        # However, for marked.js to parse it correctly, we want the raw markdown.
        return f"{opening_tag}\n{markdown_content}\n{closing_tag}"

    output_html, num_replacements = script_tag_pattern.subn(replace_script_content, template_html)

    if num_replacements == 0:
        print(f"ERROR: Could not find the placeholder comment '{MARKDOWN_PLACEHOLDER_COMMENT}'")
        print(f"       within a <script id='markdown-source'> tag in '{TEMPLATE_FILE_PATH}'.")
        print(f"       Please ensure the template is correct. Aborting.")
        return
    elif num_replacements > 1:
        print(f"WARNING: Found and replaced the placeholder multiple times ({num_replacements}).")
        print(f"         This might indicate an issue with your template structure.")


    print(f"Injecting Markdown content into template.")
    try:
        with open(OUTPUT_FILE_PATH, "w", encoding="utf-8") as out_file:
            out_file.write(output_html)
        print(f"Successfully built documentation: {OUTPUT_FILE_PATH}")
    except Exception as e:
        print(f"ERROR: Could not write output file '{OUTPUT_FILE_PATH}': {e}. Aborting.")
        return

if __name__ == "__main__":
    # Get the directory where the script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))

    # Construct full paths relative to the script directory
    # This makes the script runnable from anywhere as long as the files are co-located or paths are adjusted
    MARKDOWN_FILE_PATH = os.path.join(script_dir, "content.md")
    TEMPLATE_FILE_PATH = os.path.join(script_dir, "doc_template.html")
    OUTPUT_FILE_PATH = os.path.join(script_dir, "index.html") # Output in the same dir

    # Example for outputting to a 'dist' subdirectory:
    # DIST_DIR = os.path.join(script_dir, "dist")
    # os.makedirs(DIST_DIR, exist_ok=True)
    # OUTPUT_FILE_PATH = os.path.join(DIST_DIR, "documentation.html")

    main()