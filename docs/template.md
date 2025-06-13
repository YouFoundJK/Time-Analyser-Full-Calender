# Template Documentation Features

## Introduction to This Template

Welcome to the documentation template! This file showcases a comprehensive set of Markdown syntax and custom HTML elements commonly used in our documentation. It's designed to provide a quick reference for authors and to ensure consistency across all our user guides and manuals.

Remember, clear and concise documentation is key to a great user experience.

## Headings

Headings are crucial for structuring your document and making it easy to read.

### Level 3 Heading

#### Level 4 Heading

##### Level 5 Heading

###### Level 6 Heading

You can go up to six levels deep with headings.

## Text Formatting

Here's how to format your text for emphasis or specific contexts.

This is a standard paragraph of text. It can contain various formatting options.
It's typically used for general information and explanations.

**Bold Text**: Use double asterisks (`**bold**`) or double underscores (`__bold__`) for strong emphasis.
*Italic Text*: Use single asterisks (`*italic*`) or single underscores (`_italic_`) for emphasis.
***Bold Italic Text***: Combine them (`***bold italic***`).
~~Strikethrough Text~~: Use double tildes (`~~strikethrough~~`) to indicate deleted or irrelevant text.

`Inline Code`: Use backticks (`` `code` ``) for short snippets of code, commands, or file names. For example, `python your_script.py -h` is an inline command.

## Lists

Lists help organize information into digestible points.

### Unordered List

*   Item one
*   Item two
    *   Nested item A
    *   Nested item B
*   Item three

### Ordered List

1.  First step
2.  Second step
    1.  Sub-step 1
    2.  Sub-step 2
3.  Third step

### Mixed List Example

*   Feature A:
    1.  Detail 1.1
    2.  Detail 1.2
*   Feature B:
    *   Sub-feature B.1
    *   Sub-feature B.2

## Links

Connect to external resources or other sections of your documentation.

[External Link Example](https://www.example.com) - This is an inline link.
You can also link to sections within the *current* document using the heading's "slug" (e.g., [Text Formatting](#text-formatting)).

## Code Blocks

For larger code snippets, use fenced code blocks.

```python
# This is a Python code example
def greet(name):
    print(f"Hello, {name}!")

greet("World")
```

```csv
# This is a CSV example from the content.md
[PLAYERS_INITIAL]
Player name,Bid value,Profile Photo Path
Player One,1000,Player-One.png
Player Two,800,
```

## Blockquotes

Use blockquotes for highlighting specific statements or quotations.

> "The only way to do great work is to love what you do."
> — Steve Jobs

## Images

Embed images to provide visual context.

![Alt text for the image](path/to/your/image.png "Optional Title for the Image")

*Note: For images in our documentation, ensure they are placed in the `static/images/` directory relative to the application's root, and specify only the filename in Markdown, like `![App Screenshot](static/images/app_screenshot.png)`.*

## Tables

Organize data in a structured, tabular format.

| Header 1      | Header 2      | Header 3      |
| :------------ | :------------ | :------------ |
| Row 1, Col 1  | Row 1, Col 2  | Row 1, Col 3  |
| Row 2, Col 1  | Row 2, Col 2  | Row 2, Col 3  |
| Short text    | Longer content| Numeric: 123  |

*Note: The colons (`:` in the second line) define alignment. Left (`:` only on left), Right (`:` only on right), Center (`:` on both sides). Default is left if not specified.*

## Horizontal Rule

Use three or more hyphens, asterisks, or underscores to create a horizontal rule.

---

This is content after a horizontal rule, useful for separating sections visually.

***

Another horizontal rule using asterisks.

___

And one using underscores.

## Raw HTML & Custom Styles

Our documentation supports embedded HTML, which allows for advanced styling and custom elements not natively available in standard Markdown. This is especially useful for callout boxes like "Note" or "Warning".

<div class="note">
<strong>Important Note:</strong> This is an example of a custom "note" box using raw HTML.
It's defined with a `div` and a specific CSS class.
</div>

<div class="warning">
<strong>Caution Required:</strong> This is an example of a "warning" box.
Use these for critical information that users must pay attention to.
</div>

You can also use simple HTML tags for specific formatting needs:
This line uses a `<br>` tag to force a line break.<br>This text appears on a new line.

While Markdown `**bold**` is preferred, `<strong>Bold Text</strong>` also works.
Similarly, `<em>Italic Text</em>` can be used instead of `*italic*`.

## Conclusion

This template provides a comprehensive overview of the formatting options available for our documentation. By utilizing these features consistently, we can create clear, readable, and professional user guides.

---
**Template Version:** 1.0
**Last Updated:** October 27, 2023
