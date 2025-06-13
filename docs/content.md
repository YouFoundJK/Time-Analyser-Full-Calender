
# Time Analyser Dashboard User Guide

## Introduction

**Version:** 2.5

**Last Updated:** June 06, 2025


Welcome to the Time Analyser, an interactive dashboard designed to help you visualize and understand your time tracking data! This powerful tool processes your Markdown (`.md`) files, transforming raw entries into insightful charts and actionable summaries.

At its core, the Analyser provides a comprehensive suite of features to streamline your time analysis:

*   **Flexible Data Input:** Load your time entries by simply selecting a folder containing your Markdown files. The analyser intelligently infers data based on structured [file naming conventions](#file-naming-convention) and hierarchical [folder structures for hierarchy](#folder-structure-for-hierarchy), all guided by detailed [YAML front matter](#yaml-front-matter) that supports both single and complex [recurring events](#yaml-front-matter).
*   **Powerful Filtering Options:** Refine your analysis to focus on specific periods or categories. Apply intuitive filters for [Hierarchy](#hierarchy-filter-overall) and [Project](#project-filter-overall), and utilize the dynamic [Date Range](#date-range) selector with convenient presets (Today, This Week, etc.) to pinpoint your focus.
*   **Diverse Visualization Types:** Gain unique insights through a variety of interactive charts powered by Plotly.js, chosen via the [Analysis Types](#analysis-types) dropdown:
    *   [Categorywise Pie Charts](#1-categorywise-pie-chart) for simple time distribution.
    *   [Hierarchical Sunburst Charts](#2-categorywise-sunburst-chart) for multi-level breakdowns of your time.
    *   [Time-Series Trend charts](#3-time-series-trend) to observe how your activity changes over daily, weekly, or monthly periods.
    *   [Activity Pattern charts](#4-activity-patterns) to identify your most productive days of the week or hours of the day.
*   **Detailed Interactivity:** Dive deeper into your data. Most charts are clickable, allowing you to select specific segments or data points to open a [Detail Popup](#interacting-with-charts-detail-popup). This popup provides a granular list of all contributing records, along with summary statistics.
*   **Smart Data Management:** The dashboard offers efficient [local data caching](#understanding-the-cache) in your browser for rapid reloading of your time entries. It includes robust [error logging](#processing-log--issues) to help you troubleshoot any file parsing issues, and a convenient [cache clearing option](#clearing-the-cache) for when your source files are updated. Additionally, the dashboard remembers your last selected filters and analysis type for a seamless user experience across sessions.

This user guide will walk you through setting up your data, navigating the dashboard's controls, and interpreting your time insights to help you make the most of this powerful analysis tool.

<div class="note">
<strong>Your Data Stays Local:</strong> The Time Analyser processes all your data directly in your browser. No files are uploaded to any server, ensuring your privacy and data security.
</div>

## Getting Started: Loading Your Data

Before you can start analyzing, you need to provide the application with your time-tracking Markdown files.

### 1. Prerequisites

*   **Browser Compatibility:** Use a modern web browser (e.g., Chrome, Firefox, Edge, Safari).
*   **Time Data Files:** Your time entries must be in Markdown (`.md`) files, structured with YAML front matter.

### 2. File and Folder Structure

The analyser expects your `.md` files to be organized in a folder structure that defines `Hierarchy` and `Project`, and for each file to contain specific `YAML Front Matter`.

#### File Naming Convention

Your `.md` files should generally follow one of these patterns:

1.  `YYYY-MM-DD Project - Subproject [Serial].md`
    *   `YYYY-MM-DD`: The date of the time entry.
    *   `Project`: The main project name.
    *   `Subproject`: A more detailed sub-project or task.
    *   `[Serial]`: (Optional) A serial number (e.g., `I`, `II`, `V`, `1`, `23`).

    *Example:* `2023-10-26 Study - Chemistry I.md`

2.  `(Hierarchy) Project - Subproject [Serial].md`
    *   `(Hierarchy)`: The top-level category or department.
    *   `Project`: The main project name.
    *   `Subproject`: A more detailed sub-project or task.
    *   `[Serial]`: (Optional) A serial number.
    *   *Note:* When this format is used, the `date` must be provided in the YAML front matter.

    *Example:* `(Work) Project Alpha - Task Design.md`

#### Folder Structure for Hierarchy

The application automatically infers the `Hierarchy` based on your folder structure. For example, if you have:

```
CalenderParent/
├── Work/                          <-- Hierarchy Level 1: Subfolder "Work"
│   ├── [date] [Hierarchy Level 2:Project] - [Hierarchy Level 3:SubProject] <int>.md        (one time event)
│   ├── ([Every M]) [Hierarchy Level 2:Project] - [Hierarchy Level 3:SubProject] <int>.md   (recurring event)
│   ├── 2023-10-26 Client A - Design Phase 1.md
│   ├── 2023-11-06 Client A - Design Phase 2.md
│   ├── 2023-10-27 Client A - Development Sprint 2.md
│   └── (Every M) Team Meetings - Weekly Sync.md  (recurring event)
│   
│
├── Personal/                      <-- Hierarchy Level 1: Subfolder "Personal"
│   ├── Fitness/                   <-- This folder level is NOT currently used
│   │   ├── [date] [Hierarchy Level 2:Project] - [Hierarchy Level 3:SubProject] <int>.md
│   │   └── 2023-11-01 Gym - Workout Routine A.md
```

In this example:
*   `Work` and `Personal` would be recognized as `Hierarchies`.
*   `ProjectX` and `Learning` would be recognized as `Projects` (under their respective hierarchies).

#### YAML Front Matter

Each `.md` file *must* contain a YAML front matter block at the very top, enclosed by `---` lines. This block provides essential metadata for your time entries.

```yaml
---
startTime: "09:00"
endTime: "10:30"
date: "2023-10-26" # Required if date is not in filename or for recurring
type: "single" # "single" or "recurring"
days: 1 # Number of days for a single event (e.g., for overnight tasks)
# Recurring event specific fields (if type is "recurring")
startRecur: "2023-10-01"
endRecur: "2023-12-31"
daysOfWeek: ["M", "W", "F"] # Monday, Wednesday, Friday
---
# My Time Entry Title

Details about the task...
```

Let's break down the fields:

| Field          | Type     | Required | Description                                                                                                                                                                                                                                                                                                                                                         |
| :------------- | :------- | :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `startTime`    | String   | Yes      | The start time of the task (e.g., `"09:00"`, `"14:30"`). Can also be decimal hours (e.g., `9.5`).                                                                                                                                                                                                                                                                      |
| `endTime`      | String   | Yes      | The end time of the task (e.g., `"10:30"`, `"17:00"`). Handles overnight tasks (e.g., `startTime: "22:00"`, `endTime: "02:00"`). Can also be decimal hours.                                                                                                                                                                                                             |
| `date`         | String   | Yes*     | The specific date of the task in `YYYY-MM-DD` format (e.g., `"2023-10-26"`). *Required if the date is not part of the filename (`YYYY-MM-DD`). For `recurring` type, this field is ignored; dates are determined by `startRecur`, `endRecur`, and `daysOfWeek`.*                                                                                              |
| `type`         | String   | Yes      | Defines the nature of the event. Can be `"single"` (default) or `"recurring"`.                                                                                                                                                                                                                                                                                     |
| `days`         | Number   | No (Def. 1) | For `type: "single"` events, indicates the number of days the duration applies. Useful for multi-day tasks where `startTime`/`endTime` define daily blocks (e.g., `days: 2` means duration is `X` hours/day for 2 days). Defaults to `1`.                                                                                                                              |
| `startRecur`   | String   | Yes*     | For `type: "recurring"` events, the start date for the recurrence pattern (`YYYY-MM-DD`).                                                                                                                                                                                                                                                                              |
| `endRecur`     | String   | No (Def. indefinite) | For `type: "recurring"` events, the end date for the recurrence pattern (`YYYY-MM-DD`). If omitted, recurrence is considered indefinite (or until a global date filter restricts it).                                                                                                                                                                    |
| `daysOfWeek`   | Array/String | Yes*     | For `type: "recurring"` events, specifies which days of the week the event occurs. Can be an array (e.g., `["M", "W", "F"]`) or a comma-separated string (e.g., `"M,W,F"`). Valid characters: `U` (Sunday), `M` (Monday), `T` (Tuesday), `W` (Wednesday), `R` (Thursday), `F` (Friday), `S` (Saturday).                                                              |

<div class="warning">
<strong>Important for Recurring Events:</strong>
<br>
If you set `type: "recurring"`, the `date` and `days` fields within the YAML are ignored. Instead, the total time for a recurring entry will be calculated by multiplying the `startTime`/`endTime` duration by the number of times it occurs within the specified `startRecur`, `endRecur`, and `daysOfWeek` range, *and* also within any active global date filters you apply in the dashboard.
</div>

### 3. Selecting Your Folder

1.  Click the **"Choose Folder"** button (📁 Select Folder).
2.  A system dialog will open. Navigate to the top-level folder that contains all your time-tracking `.md` files (and their subfolders).
3.  Click **"Select Folder"** (or similar, depending on your OS).
4.  The application will begin processing your files. You will see a toast notification indicating progress and success/errors.

<div class="note">
<strong>Processing Time:</strong> For large folders with many files, initial processing might take a moment. The application uses web workers to keep the UI responsive during this phase. Once processed, data is cached locally for faster access.
</div>

## The Dashboard Layout

The Time Analyser dashboard is organized into several key areas:

*   **Header:** Contains the application title and a useful utility button.
    *   **🧹 Cache Button:** Located at the top-left. Clicking this button will clear all cached time data from your browser's local storage. This is useful if your source `.md` files have changed significantly or if you're experiencing unexpected data issues. A warning toast might appear if your cache is older than 24 hours.
*   **Controls:** The top section with all the filters and analysis type selectors. This is where you configure your view.
*   **Dashboard Layout Container:** This dynamic area contains:
    *   **Stats Grid:** Displays key summary statistics (Total Hours, Files in Filter, Active Analysis Type).
    *   **Main Chart Container:** This is where your chosen visualization (Pie, Sunburst, Time-Series, Activity Pattern) will be displayed.
*   **📋 Processing Log & Issues:** Located at the bottom, this section provides feedback on the data loading process and any errors encountered during file parsing.

## Using the Filters

The "Controls" section at the top allows you to refine the data displayed in the dashboard. Filters are cumulative; applying multiple filters will narrow down the results further.

### 1. Hierarchy Filter (Overall)

*   **Input Field:** `📂 Filter by Hierarchy (Overall)`
*   **Purpose:** Narrows down the analysis to records belonging to a specific top-level hierarchy (e.g., "Work", "Personal").
*   **Usage:**
    1.  Start typing in the input field. An autocomplete list will appear with available hierarchies from your data.
    2.  Select a hierarchy from the suggestions or type the full name.
    3.  Click the `×` button to clear the filter.

### 2. Project Filter (Overall)

*   **Input Field:** `📋 Filter by Project (Overall)`
*   **Purpose:** Filters the analysis to records associated with a particular project, regardless of its hierarchy.
*   **Usage:**
    1.  Type in the input field. Autocomplete suggestions will appear based on projects found in your data.
    2.  Select a project or type its full name.
    3.  Click the `×` button to clear the filter.

### 3. Date Range

*   **Input Field:** `📅 Date Range`
*   **Purpose:** Filters records by their date. This is crucial for analyzing time spent within specific periods.
*   **Usage:**
    1.  **Select Dates:** Click the input field to open the date picker. Choose a start date and an end date. The chart will update automatically.
    2.  **Date Presets:**
        *   **Today:** Sets the date range to the current day.
        *   **Yesterday:** Sets the date range to the previous day.
        *   **This Week:** Sets the date range from the most recent Monday to the following Sunday.
        *   **This Month:** Sets the date range from the 1st of the current month to the last day of the current month.
    3.  **🗑️ Clear Dates:** Clears any active date filters, showing all available data regardless of date.

## Analysis Types

The `🎯 Analysis Type` dropdown allows you to switch between different visualizations, each offering unique insights into your time data. Depending on your selection, additional controls will appear to customize the chart.

### 1. Categorywise (Pie Chart)

*   **Purpose:** Visualizes how time is distributed across different categories (Hierarchy, Project, or Sub-project) in a single slice.
*   **Controls:**
    *   **📈 Breakdown Level:** Choose how you want to categorize your time:
        *   `Hierarchy`: Time split by top-level folders.
        *   `Project`: Time split by project names.
        *   `Sub-project`: Time split by sub-project names.
    *   **🔍 Category Filter (Regex):** Enter a regular expression to filter the categories shown in the pie chart. Only categories matching the regex will be included.
        *   *Example:* `^Work` will show categories starting with "Work". `.*Task.*` will show categories containing "Task".
*   **Interpretation:** Each slice represents a category, with its size proportional to the total hours spent. Hover over slices for exact values and percentages.
*   **Interactivity:** Click on a slice to open a [Detail Popup](#interacting-with-charts-detail-popup) showing all records contributing to that category.

### 2. Categorywise (Sunburst Chart)

*   **Purpose:** Provides a hierarchical visualization of time distribution, showing how outer categories (e.g., Projects) break down into inner categories (e.g., Hierarchies) or vice-versa.
*   **Controls:**
    *   **📈 Breakdown Level:** Defines the hierarchy displayed:
        *   `Projects by Hierarchy`: Inner ring shows Hierarchies, outer ring shows Projects within those hierarchies.
        *   `Sub-projects by Project`: Inner ring shows Projects, outer ring shows Sub-projects within those projects.
    *   **🔍 Category Filter (Regex):** Similar to the Pie chart, this filters the *outermost* category displayed.
*   **Interpretation:**
    *   The center represents the total time.
    *   Inner rings represent higher-level categories (e.g., Hierarchies or Projects).
    *   Outer rings represent sub-categories (e.g., Projects within Hierarchies, or Sub-projects within Projects).
    *   The size of each segment corresponds to the hours spent.
    *   An **external legend** on the right lists all segments, allowing you to highlight specific parts of the chart by clicking their legend item.
*   **Interactivity:**
    *   Hover over segments for detailed information (label, value, percentage).
    *   Click on an inner segment to "zoom in" and show only its children. Click the center to zoom out.
    *   Click on any segment (except the very center) to open a [Detail Popup](#interacting-with-charts-detail-popup) for the records associated with that specific segment.
    *   Click an item in the external legend to highlight that category and its children/parents in the sunburst chart, while fading out other categories.

### 3. Time-Series Trend

*   **Purpose:** Visualizes how your total time spent changes over a period, allowing you to identify trends and busy/slow periods.
*   **Controls:**
    *   **🕒 Granularity:** Defines the time intervals for the trend:
        *   `Daily`: Shows total hours per day.
        *   `Weekly`: Shows total hours per week (starting Monday).
        *   `Monthly`: Shows total hours per month.
    *   **📊 Chart Type:**
        *   `Overall Trend`: A single line chart showing total hours over time.
        *   `Stacked by Category`: A stacked area chart, breaking down total hours by an additional category (e.g., Project, Hierarchy).
    *   **📚 Stack By:** (Visible only when `Chart Type` is `Stacked by Category`)
        *   `Hierarchy`: Stacks by top-level folders.
        *   `Project`: Stacks by project names.
        *   `Sub-project`: Stacks by sub-project names.
*   **Interpretation:**
    *   **Line Chart:** Clearly shows the rise and fall of total hours over your chosen period.
    *   **Stacked Area Chart:** Reveals the contribution of different categories to your overall time trend. Each colored band represents a category.
*   **Interactivity:** Click on a data point (or a vertical slice in stacked charts) to open a [Detail Popup](#interacting-with-charts-detail-popup) listing all records contributing to that specific period.

### 4. Activity Patterns

*   **Purpose:** Helps you identify patterns in *when* your tasks are typically performed, either by day of the week or hour of the day.
*   **Controls:**
    *   **📅 Analyze by:** Choose the type of pattern analysis:
        *   `Day of Week`: A bar chart showing total hours spent on each day of the week.
        *   `Hour of Day (Task Start)`: A bar chart showing total hours associated with tasks that *start* in each hour of the day (0-23).
        *   `Heatmap (Day vs Hour)`: A heatmap where rows are days of the week, columns are hours of the day, and color intensity represents total hours for tasks starting at that specific day/hour combination. This is powerful for identifying specific "active slots."
*   **Interpretation:**
    *   **Bar Charts:** Easily compare activity levels across days or hours.
    *   **Heatmap:** Provides a visual density map. Darker colors indicate more hours spent in that specific day-of-week and hour-of-day slot. Null/zero values are shown as blank.
*   **Interactivity:** Click on a bar (in bar charts) or a cell (in heatmap) to open a [Detail Popup](#interacting-with-charts-detail-popup) showing the records contributing to that specific activity slot.

## Interacting with Charts: Detail Popup

Most charts in the Time Analyser are interactive. Clicking on a segment (Pie, Sunburst), a data point/period (Time-Series), or a bar/cell (Activity Patterns) will open a `Detail Popup`.

*   **Popup Title:** Shows the name of the category or period you clicked on.
*   **Summary Stats:** Provides a quick overview:
    *   `Unique Files`: Number of distinct Markdown files that contributed to the selected data.
    *   `Total Hours`: The total duration for the clicked category/period.
    *   `Avg. Hrs/File`: The average hours per unique file in that category/period.
*   **Detail Table:** A scrollable table listing the individual records that make up the selected data.
    *   **File Path:** The relative path to the Markdown file.
    *   **Date:** The date of the record. For recurring events, it shows "Recurring" as the date, but the `_effectiveDurationInPeriod` in the row's calculation accounts for its occurrences within the *global* date filter.
    *   **Duration (hrs):** The calculated duration of the record (or total for recurring instances within the global filter).
    *   **Project:** The project name.
    *   **Sub-project (Full):** The full sub-project name, including any serial numbers.

Click the `×` button or anywhere on the grey overlay to close the popup.

## Managing Your Data & Cache

The Time Analyser uses your browser's local storage to cache parsed data, which significantly speeds up subsequent analyses after the initial folder selection.

### Understanding the Cache

*   When you select a folder, the application parses all `.md` files and stores the extracted data in your browser's `localStorage`.
*   This cached data is associated with the file's path and its `lastModified` timestamp. If a file's content or timestamp changes, it will be re-parsed.
*   A `Local cache updated` message in the `Processing Log & Issues` section indicates when the cache was last written.

### Cache Warning

*   If your cached data is older than 24 hours, you'll see a **warning** message in the `Processing Log & Issues` section and a persistent warning toast.
*   The `Choose Folder` button will also gently `shake` to draw your attention.
*   This warning is a reminder that your cached data might be out of sync with your latest files.

### Clearing the Cache

*   Click the **🧹 Cache** button in the header.
*   This will immediately delete all cached data from your browser's local storage.
*   After clearing, you'll need to re-select your folder to load your data again. This is useful for:
    *   Ensuring you are working with the absolute latest versions of your files.
    *   Troubleshooting unexpected data inconsistencies.
    *   Freeing up browser local storage space (though time data records are typically small).

### 📋 Processing Log & Issues

This section provides detailed feedback on the application's operations:

*   **Cache Status:** Shows the last update time of your local cache and any warnings if it's old.
*   **Processing Summary:** Updates with messages about how many files were processed (new vs. from cache) and the total valid records.
*   **Error Entries:** If any `.md` files failed to parse (e.g., due to malformed YAML, invalid dates, or incorrect filenames), a summary will appear here. You can expand each entry to see the `File`, its `Path`, and the `Reason` for the parsing failure.


## Troubleshooting & FAQ

Here are some common issues and questions you might encounter:

### General Issues

*   **Q: My folder selection doesn't seem to do anything / No files are loaded.**
    *   **A:** Ensure you are selecting a folder that *contains* `.md` files directly or in its subfolders. Some browsers require explicit permission. Check if the files have the correct `.md` extension.
*   **Q: The dashboard says "No data matches current filters." but I know I have data.**
    *   **A:** Check your filters:
        1.  Are your `Date Range` filters too restrictive? Try clearing them with **🗑️ Clear Dates**.
        2.  Are your `Hierarchy` or `Project` filters too specific or misspelled? Try clearing them.
        3.  For Pie/Sunburst, is your `Category Filter (Regex)` too restrictive or malformed? Clear it or simplify it.
        4.  Ensure your `.md` files are correctly formatted and successfully parsed (check the `Processing Log & Issues`).
*   **Q: The application is slow or unresponsive after selecting a very large folder.**
    *   **A:** While the application uses web workers for responsiveness, initial parsing of thousands of files can still take time. Please be patient. Once cached, subsequent loads will be much faster.
*   **Q: I see a "Warning: Cache is older than 24 hours." message.**
    *   **A:** This is a gentle reminder that your cached data might not reflect your absolute latest time entries if you've modified your `.md` files recently. It's recommended to click the **🧹 Cache** button and re-select your folder to ensure you have the most up-to-date analysis.

### Data & Parsing Issues

*   **Q: Why are some of my records missing or showing "N/A" in the Detail Popup?**
    *   **A:** This usually indicates a parsing error for that specific file. Check the `Processing Log & Issues` section at the bottom of the dashboard. Expand any log entries to see the `File Path` and `Reason` for the error (e.g., invalid YAML, missing `startTime`, `endTime`, or `date`). Correct the source `.md` file and then clear the cache and re-select your folder.
*   **Q: My recurring events aren't showing up correctly or seem to have incorrect durations.**
    *   **A:**
        1.  Ensure `type: "recurring"` is correctly set in the YAML front matter.
        2.  Verify `startRecur`, `endRecur` (if applicable), and `daysOfWeek` are present and correctly formatted.
        3.  Check if your global date filters are too restrictive and are cutting off the recurrence range.
        4.  Remember the `date` field in YAML is ignored for recurring types.
*   **Q: What are "Hierarchy", "Project", and "Sub-project" based on?**
    *   **A:**
        *   `Hierarchy`: Inferred from the immediate subfolder within the main folder you selected (e.g., `my-data/Work/ProjectA...` makes "Work" the hierarchy). If no subfolder, it's typically "root". It can also be explicitly defined in the filename `(Hierarchy)`.
        *   `Project`: Inferred from the filename (e.g., `YYYY-MM-DD Project - ...`) or `(Hierarchy) Project - ...`.
        *   `Sub-project`: Inferred from the filename (e.g., `... - Subproject [Serial].md`). `Sub-project (Full)` includes the optional serial number.

### Chart-Specific Questions

*   **Q: My Sunburst or Pie chart is blank or doesn't show the categories I expect.**
    *   **A:**
        1.  Ensure your `Breakdown Level` is set correctly for the data you want to see.
        2.  Check the `Category Filter (Regex)`. A strict or incorrect regex will filter out all your data. Try clearing it.
        3.  Verify that records actually exist for the chosen breakdown level within your filtered data.
*   **Q: The Time-Series chart seems to skip dates/weeks/months.**
    *   **A:** The chart will only plot periods for which there is *data*. If you have gaps in your time tracking, those periods will naturally appear as gaps or zero values on the chart.
*   **Q: The Activity Patterns heatmap shows a lot of blank cells.**
    *   **A:** Blank cells indicate that no tasks started within that specific hour on that specific day of the week, given your current filters. It's a visual representation of your activity density.
