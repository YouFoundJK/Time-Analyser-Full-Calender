// parser.worker.js

// Import the js-yaml library.
// Adjust the path if js-yaml.min.js is located elsewhere relative to this worker script.
// If your main HTML is in the root, and js-yaml.min.js is in Self-development/,
// and parser.worker.js is also in the root, this path should work.
// If parser.worker.js is in a 'workers' subfolder, the path would be '../Self-development/js-yaml.min.js'
try {
    importScripts('js-yaml.min.js');
} catch (e) {
    console.error('Worker: Failed to import js-yaml.min.js. Path might be incorrect.', e);
    // Post an error back to the main thread if critical libraries fail to load
    self.postMessage({ error: { message: 'Worker failed to load YAML library.' } });
    throw e; // Stop worker execution
}


// --- Helper functions (copied and adapted from TimeAnalyzer) ---
// These need to be self-contained or passed to the worker if they depend on 'this' from the class

function calculateDuration(startTime, endTime, days = 1) {
    const parseTime = (timeStr) => {
        if (typeof timeStr === 'number') {
            const hours = Math.floor(timeStr);
            const minutes = Math.round((timeStr - hours) * 60);
            return { hours, minutes };
        }
        const timeMatch = String(timeStr).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
        if (timeMatch) return { hours: parseInt(timeMatch[1]), minutes: parseInt(timeMatch[2]) };
        try {
            const d = new Date(timeStr);
            if (!isNaN(d.getTime())) return { hours: d.getUTCHours(), minutes: d.getUTCMinutes() };
        } catch (e) { /* ignore */ }
        // console.error(`Worker: Invalid time format: ${timeStr}. Expected HH:MM or decimal hours.`);
        throw new Error(`Invalid time format: ${timeStr}.`); // Let parseFile catch and report
    };
    try {
        const start = parseTime(startTime), end = parseTime(endTime);
        let startMinutes = start.hours * 60 + start.minutes;
        let endMinutes = end.hours * 60 + end.minutes;
        if (endMinutes < startMinutes) endMinutes += 24 * 60;
        const durationForOneDay = (endMinutes - startMinutes) / 60;
        return durationForOneDay * (Math.max(0, Number(days) || 0));
    } catch (error) {
        // console.error("Worker: Error calculating duration:", error.message, "startTime:", startTime, "endTime:", endTime, "days:", days);
        throw error; // Propagate error to be caught by parseFile
    }
}


async function parseFileInWorker(fileObject, fileContent) {
    // fileObject contains name, webkitRelativePath
    // fileContent is the text content of the file
    try {
        const pathParts = fileObject.webkitRelativePath.split('/');
        const hierarchy = pathParts.length > 2 ? pathParts[1] : (pathParts.length === 2 && pathParts[0] !== "" ? pathParts[0] : 'root');

        const filenameRegex = /^(?:(\d{4}-\d{2}-\d{2})\s+(.+?)\s+-\s+(.+?)(?:\s+([IVXLCDM\d]+))?|(?:\(([^)]+)\)\s*)(.+?)(?:\s*-\s*(.+?))?(?:\s+([IVXLCDM\d]+))?)\.md$/i;
        const filenameMatch = fileObject.name.match(filenameRegex);

        if (!filenameMatch) {
            throw new Error('Filename pattern mismatch.');
        }

        let dateStr, projectFromFile, subprojectRaw, serialFromFile;
        if (filenameMatch[1]) {
            dateStr = filenameMatch[1];
            projectFromFile = filenameMatch[2];
            subprojectRaw = filenameMatch[3];
            serialFromFile = filenameMatch[4];
        } else {
            projectFromFile = filenameMatch[6];
            subprojectRaw = filenameMatch[7];
            serialFromFile = filenameMatch[8];
        }

        if (!self.jsyaml) { // Check if jsyaml loaded
             throw new Error('js-yaml library not loaded in worker.');
        }

        const yamlMatch = fileContent.match(/^---\s*\n([\s\S]*?)\n---/);
        if (!yamlMatch) throw new Error('No YAML front matter found.');
        let metadata;
        try {
            metadata = self.jsyaml.load(yamlMatch[1]);
        } catch (yamlError) {
            throw new Error(`Invalid YAML: ${yamlError.message}`);
        }

        if (!metadata || typeof metadata !== 'object') {
            throw new Error('YAML front matter is empty or not an object.');
        }
        if (!metadata.startTime || !metadata.endTime) {
            throw new Error('Missing startTime or endTime in YAML.');
        }

        let eventDuration;
        if (metadata.type === 'recurring') {
            if (metadata.startTime && metadata.endTime) {
                eventDuration = calculateDuration(metadata.startTime, metadata.endTime, 1);
            } else {
                eventDuration = 0;
            }
        } else {
            eventDuration = calculateDuration(metadata.startTime, metadata.endTime, metadata.days);
        }

        let recordDate = null;
        if (dateStr) {
            const [year, month, day] = dateStr.split('-').map(Number);
            recordDate = new Date(Date.UTC(year, month - 1, day));
        } else if (metadata.date) {
            const metaDateVal = metadata.date;
            if (metaDateVal instanceof Date && !isNaN(metaDateVal.getTime())) {
                recordDate = new Date(Date.UTC(metaDateVal.getFullYear(), metaDateVal.getMonth(), metaDateVal.getDate()));
            } else {
                const metaDateStr = metaDateVal.toString();
                const datePartsMatch = metaDateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                if (datePartsMatch) {
                    const [year, month, day] = datePartsMatch.slice(1).map(Number);
                    recordDate = new Date(Date.UTC(year, month - 1, day));
                } else {
                    let parsedFallback = new Date(metaDateStr);
                    if (!isNaN(parsedFallback.getTime())) {
                         recordDate = new Date(Date.UTC(parsedFallback.getFullYear(), parsedFallback.getMonth(), parsedFallback.getDate()));
                    }
                }
            }
        }
        if (recordDate && isNaN(recordDate.getTime())) {
            throw new Error(`Invalid date in filename or YAML: ${dateStr || metadata.date}`);
        }
        // Convert Date object to ISO string for sending back, main thread will rehydrate
        const recordDateISO = recordDate ? recordDate.toISOString() : null;


        const finalProject = projectFromFile.trim();
        let baseSubproject = 'none';
        let fullSubproject = 'none';

        if (subprojectRaw) {
            subprojectRaw = subprojectRaw.trim();
            const subprojectSerialMatch = subprojectRaw.match(/^(.*?)\s+([IVXLCDM\d]+)$/);
            if (subprojectSerialMatch) {
                baseSubproject = subprojectSerialMatch[1].trim();
                serialFromFile = serialFromFile || subprojectSerialMatch[2];
            } else {
                baseSubproject = subprojectRaw;
            }
            fullSubproject = baseSubproject;
            if (serialFromFile) {
                fullSubproject += ` ${serialFromFile.trim()}`;
            }
        }
        if (baseSubproject === "") baseSubproject = 'none';
        fullSubproject = fullSubproject.trim();
        if (fullSubproject === "") fullSubproject = 'none';

        return {
            path: fileObject.webkitRelativePath,
            hierarchy: hierarchy,
            project: finalProject,
            subproject: baseSubproject,
            subprojectFull: fullSubproject,
            duration: eventDuration,
            file: fileObject.name, // Original filename
            date: recordDateISO, // Send as ISO string
            metadata: metadata
        };
    } catch (error) {
        // console.error(`Worker: Error parsing ${fileObject.name}: ${error.message}`);
        // Post an error message back to the main thread
        return {
            filePath: fileObject.webkitRelativePath,
            fileName: fileObject.name,
            error: error.message
        };
    }
}


self.onmessage = async function(e) {
    const { file } = e.data; // The File object itself cannot be directly cloned to worker in all browsers
                             // So we read its content in main thread and pass content.
                             // Here, we assume `file` is an object {name, webkitRelativePath, content, lastModified}
    
    if (!file || !file.content) {
        self.postMessage({
            filePath: file ? file.webkitRelativePath : 'Unknown',
            fileName: file ? file.name : 'Unknown',
            error: 'File content not provided to worker.'
        });
        return;
    }

    try {
        const result = await parseFileInWorker(
            { name: file.name, webkitRelativePath: file.webkitRelativePath }, // Pass necessary file metadata
            file.content // Pass file content
        );

        if (result.error) { // If parseFileInWorker returned an error object
            self.postMessage({ type: 'parse_error', data: result });
        } else {
            self.postMessage({ type: 'parsed_record', data: result });
        }
    } catch (processingError) { // Catch any unexpected errors within the onmessage handler
         self.postMessage({
            type: 'parse_error',
            data: {
                filePath: file.webkitRelativePath,
                fileName: file.name,
                error: processingError.message || 'Unknown processing error in worker'
            }
        });
    }
};