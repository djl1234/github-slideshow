/**
 * Cattle Feed Lot Monitor - PDF Yard Sheet Importer
 * Parses PDF yard sheets and extracts lot/pen data into the app.
 *
 * Uses Mozilla pdf.js (loaded via CDN in index.html).
 */
var PDFImport = (function () {
    'use strict';

    // --- Known column header patterns ---
    // These help us identify which column maps to which field
    var HEADER_PATTERNS = {
        trl:         /^trl$/i,
        srt:         /^srt$/i,
        prog:        /^prog$/i,
        fo:          /^fo$/i,
        lotNum:      /^lot$/i,
        pen:         /^pen$/i,
        sfPerHd:     /^sf\/?h/i,
        bunkInPerHd: /^bunk/i,
        sex:         /^sx$/i,
        avgWt:       /^av\s?wt$/i,
        dof:         /^dof$/i,
        dors:        /^dors$/i,
        ewt:         /^ewt$/i,
        dateIn:      /^date\s?in$/i,
        dateOut:     /^date\s?out$/i,
        origHdIn:    /^orig/i,
        locLot:      null,  // handled in grouped headers
        locPen:      null,
        locH:        /^h$/i,
        locB:        /^b$/i,
        locR:        /^r$/i,
        sold:        /^sold$/i,
        deadsNo:     /^no$/i,
        deadsPct:    /^%$/i,
        ratn:        /^ratn$/i,
        consNeg1:    /^-1$/i,
        cons7d:      /^7d$/i,
        consYtd:     /^ytd$/i,
        curChgs:     /^cur/i,
        ytdChgs:     /^ytd\s?chg/i,
        customer:    /^cust/i
    };

    /**
     * Read a PDF File object and extract text content, organized by page.
     * Returns a Promise resolving to an array of page text strings.
     */
    function extractTextFromPDF(file) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () {
                var typedArray = new Uint8Array(reader.result);
                // pdfjsLib should be loaded globally from CDN
                if (typeof pdfjsLib === 'undefined') {
                    reject(new Error('pdf.js library not loaded. Please check your internet connection.'));
                    return;
                }

                var loadingTask = pdfjsLib.getDocument({ data: typedArray });
                loadingTask.promise.then(function (pdf) {
                    var pages = [];
                    var numPages = pdf.numPages;

                    function getPage(pageNum) {
                        if (pageNum > numPages) {
                            resolve(pages);
                            return;
                        }
                        pdf.getPage(pageNum).then(function (page) {
                            page.getTextContent().then(function (textContent) {
                                // Group text items by their Y position to reconstruct rows
                                var rows = groupTextIntoRows(textContent.items);
                                pages.push(rows);
                                getPage(pageNum + 1);
                            });
                        }).catch(reject);
                    }

                    getPage(1);
                }).catch(reject);
            };
            reader.onerror = function () {
                reject(new Error('Failed to read file: ' + file.name));
            };
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Group PDF text items into rows based on their Y coordinate.
     * Returns an array of row strings.
     */
    function groupTextIntoRows(items) {
        if (!items || items.length === 0) return [];

        // Determine a Y tolerance based on the typical font size in the document.
        // item.transform is [scaleX, skewY, skewX, scaleY, x, y] where scaleX ~ font size.
        var avgFontSize = 0;
        var count = 0;
        items.forEach(function (item) {
            var fs = Math.abs(item.transform[0]) || Math.abs(item.transform[3]);
            if (fs > 0) { avgFontSize += fs; count++; }
        });
        avgFontSize = count > 0 ? avgFontSize / count : 10;
        // Y tolerance: half the average font size, clamped between 3 and 10
        var yTolerance = Math.max(3, Math.min(10, avgFontSize * 0.6));

        // Sort items by Y (descending = top to bottom), then X (left to right)
        var sorted = items.slice().sort(function (a, b) {
            var yDiff = b.transform[5] - a.transform[5]; // Y descending
            if (Math.abs(yDiff) > yTolerance) return yDiff;
            return a.transform[4] - b.transform[4]; // X ascending
        });

        var rows = [];
        var currentRow = [];
        var currentY = sorted[0].transform[5];

        sorted.forEach(function (item) {
            var y = item.transform[5];
            // If Y position differs by more than the tolerance, it's a new row
            if (Math.abs(y - currentY) > yTolerance) {
                if (currentRow.length > 0) {
                    rows.push(buildRowFromItems(currentRow));
                }
                currentRow = [];
                currentY = y;
            }
            currentRow.push(item);
        });

        if (currentRow.length > 0) {
            rows.push(buildRowFromItems(currentRow));
        }

        return rows;
    }

    /**
     * Build a row object with both the joined text and individual cell positions.
     */
    function buildRowFromItems(items) {
        // Sort by X position
        items.sort(function (a, b) { return a.transform[4] - b.transform[4]; });

        var cells = [];
        var prevEnd = -Infinity;

        items.forEach(function (item) {
            var x = item.transform[4];
            var text = item.str.trim();
            if (!text) return;

            // Calculate the rendered width of this text item in page space.
            // item.width is in text space; multiply by the horizontal scale factor.
            var fontSize = Math.abs(item.transform[0]) || Math.abs(item.transform[3]) || 10;
            var renderedWidth = item.width ? item.width : text.length * fontSize * 0.5;
            // Gap threshold: 1.5x the font size (roughly the width of one character)
            var gapThreshold = Math.max(5, fontSize * 1.5);

            // If gap > threshold, consider it a new cell
            if (x - prevEnd > gapThreshold) {
                cells.push({ text: text, x: x });
            } else {
                // Append to previous cell
                if (cells.length > 0) {
                    cells[cells.length - 1].text += ' ' + text;
                } else {
                    cells.push({ text: text, x: x });
                }
            }
            prevEnd = x + renderedWidth;
        });

        return {
            text: cells.map(function (c) { return c.text; }).join('\t'),
            cells: cells
        };
    }

    /**
     * Parse extracted PDF rows into lot/pen records.
     * This attempts multiple strategies to find and parse tabular data.
     */
    function parseYardSheetRows(allPages) {
        var pens = [];

        allPages.forEach(function (rows) {
            // Strategy 1: Find header row and parse subsequent data rows
            var headerInfo = findHeaderRow(rows);
            if (headerInfo) {
                var dataRows = rows.slice(headerInfo.index + 1);
                dataRows.forEach(function (row) {
                    var pen = parseDataRow(row, headerInfo.columns);
                    if (pen && pen.lotNum) {
                        pens.push(pen);
                    }
                });
                return;
            }

            // Strategy 2: Pattern-based extraction (no clear header)
            rows.forEach(function (row) {
                var pen = tryPatternParse(row.text);
                if (pen && pen.lotNum) {
                    pens.push(pen);
                }
            });
        });

        return pens;
    }

    /**
     * Find the header row in the page and identify column positions.
     */
    function findHeaderRow(rows) {
        var bestMatch = null;
        var bestScore = 0;

        for (var i = 0; i < Math.min(rows.length, 20); i++) {
            var text = rows[i].text.toLowerCase();
            var cells = rows[i].cells;

            // Check if this row contains enough header keywords
            var matches = 0;
            var keywords = ['lot', 'pen', 'dof', 'hd', 'wt', 'date', 'ewt', 'sold', 'sx', 'trl', 'prog', 'orig', 'bunk', 'ratn', 'cust'];
            keywords.forEach(function (kw) {
                if (text.indexOf(kw) !== -1) matches++;
            });

            // Accept if we match at least 2 keywords AND have enough cells
            if (matches >= 2 && cells.length >= 3) {
                // Map cell positions to field names
                var columns = mapHeaderCells(cells);
                var colCount = Object.keys(columns).length;
                // Score by both keyword matches and identified columns
                var score = matches + colCount;
                if (colCount >= 2 && score > bestScore) {
                    bestScore = score;
                    bestMatch = { index: i, columns: columns };
                }
            }
        }

        return bestMatch;
    }

    /**
     * Map header cells to field names using pattern matching.
     */
    function mapHeaderCells(cells) {
        var columns = {};
        var lotSeen = false;
        var penSeen = false;

        cells.forEach(function (cell, idx) {
            var text = cell.text.trim();
            var matched = false;

            Object.keys(HEADER_PATTERNS).forEach(function (field) {
                if (matched) return;
                var pattern = HEADER_PATTERNS[field];
                if (!pattern) return;
                if (pattern.test(text)) {
                    // Handle duplicate "Lot" and "Pen" columns
                    // First occurrence = main lot/pen, second = location lot/pen
                    if (field === 'lotNum') {
                        if (lotSeen) {
                            columns['locLot'] = { index: idx, x: cell.x };
                        } else {
                            columns[field] = { index: idx, x: cell.x };
                            lotSeen = true;
                        }
                        matched = true;
                        return;
                    }
                    if (field === 'pen') {
                        if (penSeen) {
                            columns['locPen'] = { index: idx, x: cell.x };
                        } else {
                            columns[field] = { index: idx, x: cell.x };
                            penSeen = true;
                        }
                        matched = true;
                        return;
                    }

                    if (!columns[field]) {
                        columns[field] = { index: idx, x: cell.x };
                        matched = true;
                    }
                }
            });
        });

        return columns;
    }

    /**
     * Parse a data row using the column mapping from the header.
     */
    function parseDataRow(row, columns) {
        var cells = row.cells;
        if (!cells || cells.length < 3) return null;

        // Calculate the average column spacing to set a dynamic tolerance
        var colXValues = Object.keys(columns).map(function (f) { return columns[f].x; }).sort(function (a, b) { return a - b; });
        var avgSpacing = 50; // default
        if (colXValues.length > 1) {
            var totalSpacing = 0;
            for (var i = 1; i < colXValues.length; i++) {
                totalSpacing += colXValues[i] - colXValues[i - 1];
            }
            avgSpacing = totalSpacing / (colXValues.length - 1);
        }
        // Allow matching within 75% of the average column spacing
        var xTolerance = Math.max(30, avgSpacing * 0.75);

        // Match data cells to header columns by nearest X position
        var pen = {};
        Object.keys(columns).forEach(function (field) {
            var colX = columns[field].x;
            var colIdx = columns[field].index;

            // Find the cell closest to this column's X position
            var best = null;
            var bestDist = Infinity;
            cells.forEach(function (cell) {
                var dist = Math.abs(cell.x - colX);
                if (dist < bestDist) {
                    bestDist = dist;
                    best = cell;
                }
            });

            // Also try index-based matching
            var indexCell = cells[colIdx];

            // Use whichever match is more reasonable
            var value = '';
            if (best && bestDist < xTolerance) {
                value = best.text.trim();
            } else if (indexCell) {
                value = indexCell.text.trim();
            }

            pen[field] = convertValue(field, value);
        });

        return pen;
    }

    /**
     * Convert a raw text value to the appropriate type for the given field.
     */
    function convertValue(field, value) {
        if (!value || value === '-' || value === '--') return fieldDefault(field);

        // Remove $ and commas for numeric fields
        var cleaned = value.replace(/[$,]/g, '').trim();

        switch (field) {
            case 'lotNum':
            case 'sfPerHd':
            case 'avgWt':
            case 'dof':
            case 'dors':
            case 'ewt':
            case 'origHdIn':
            case 'locLot':
            case 'locPen':
            case 'locH':
            case 'locB':
            case 'locR':
            case 'sold':
            case 'deadsNo':
                return parseInt(cleaned, 10) || 0;

            case 'bunkInPerHd':
            case 'deadsPct':
            case 'consNeg1':
            case 'cons7d':
            case 'consYtd':
            case 'curChgs':
            case 'ytdChgs':
                return parseFloat(cleaned) || 0;

            default:
                return value;
        }
    }

    /**
     * Return sensible defaults for each field type.
     */
    function fieldDefault(field) {
        var numericFields = [
            'lotNum', 'sfPerHd', 'avgWt', 'dof', 'dors', 'ewt', 'origHdIn',
            'locLot', 'locPen', 'locH', 'locB', 'locR', 'sold', 'deadsNo',
            'bunkInPerHd', 'deadsPct', 'consNeg1', 'cons7d', 'consYtd',
            'curChgs', 'ytdChgs'
        ];
        if (numericFields.indexOf(field) !== -1) return 0;
        return '';
    }

    /**
     * Try pattern-based parsing for a single text line.
     * Looks for known data patterns (lot numbers, pen IDs, dates, weights).
     */
    function tryPatternParse(text) {
        // Look for lot number pattern: 4-6 digit number
        var lotMatch = text.match(/\b(\d{4,6})\b/);
        if (!lotMatch) return null;

        // Look for pen pattern: letter + digits (e.g. B25, A13)
        var penMatch = text.match(/\b([A-Z]\d{1,3})\b/);

        // Look for date pattern: M/D/YYYY, MM/DD/YYYY, or M/D/YY
        var dateMatches = text.match(/\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/g);

        // Look for sex: standalone O or H
        var sexMatch = text.match(/\b([OH])\b/);

        // Extract all numbers from the line
        var numbers = [];
        var numRegex = /\b(\d+\.?\d*)\b/g;
        var m;
        while ((m = numRegex.exec(text)) !== null) {
            numbers.push(parseFloat(m[1]));
        }

        if (!penMatch && numbers.length < 3) return null;

        var pen = {
            trl: '',
            srt: '',
            prog: '',
            fo: '',
            lotNum: parseInt(lotMatch[1], 10),
            pen: penMatch ? penMatch[1] : '',
            sfPerHd: 0,
            bunkInPerHd: 0,
            sex: sexMatch ? sexMatch[1] : '',
            avgWt: 0,
            dof: 0,
            dors: 0,
            ewt: 0,
            dateIn: dateMatches && dateMatches[0] ? dateMatches[0] : '',
            dateOut: dateMatches && dateMatches[1] ? dateMatches[1] : '',
            origHdIn: 0,
            locLot: 0,
            locPen: 0,
            locH: 0,
            locB: 0,
            locR: 0,
            sold: 0,
            deadsNo: 0,
            deadsPct: 0,
            ratn: '',
            consNeg1: 0,
            cons7d: 0,
            consYtd: 0,
            curChgs: 0,
            ytdChgs: 0,
            customer: ''
        };

        // Check for known Trl values
        if (/\bUltra\b/i.test(text)) pen.trl = 'Ultra';
        else if (/\bHR\b/.test(text)) pen.trl = 'HR';

        // Check for known Srt values
        if (/\bStrt\b/i.test(text)) pen.srt = 'Strt';
        else if (/\bLot\b/i.test(text)) pen.srt = 'Lot';

        // Check for known Prog values
        if (/\bHOL\b/.test(text)) pen.prog = 'HOL';
        else if (/\bDEF\b/.test(text)) pen.prog = 'DEF';

        // Try to find customer name (usually all caps at end)
        var custMatch = text.match(/\b([A-Z]{2,}\s+(?:CO|INC|LLC|CORP|LTD|RANCH|FARMS?|CATTLE))\b/i);
        if (custMatch) pen.customer = custMatch[1];

        return pen;
    }

    /**
     * Main import function: processes an array of File objects.
     * Returns a Promise resolving to an array of parsed pen records.
     */
    function importFiles(files) {
        var allPens = [];

        return new Promise(function (resolve, reject) {
            var fileArray = Array.from(files).filter(function (f) {
                return f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
            });

            if (fileArray.length === 0) {
                reject(new Error('No PDF files selected.'));
                return;
            }

            var processed = 0;
            var errors = [];

            fileArray.forEach(function (file) {
                extractTextFromPDF(file).then(function (pages) {
                    var pens = parseYardSheetRows(pages);
                    // Tag each pen with the source file
                    pens.forEach(function (p) { p._sourceFile = file.name; });
                    allPens = allPens.concat(pens);

                    processed++;
                    if (processed === fileArray.length) {
                        resolve({
                            pens: allPens,
                            fileCount: fileArray.length,
                            errors: errors
                        });
                    }
                }).catch(function (err) {
                    errors.push({ file: file.name, error: err.message });
                    processed++;
                    if (processed === fileArray.length) {
                        resolve({
                            pens: allPens,
                            fileCount: fileArray.length,
                            errors: errors
                        });
                    }
                });
            });
        });
    }

    /**
     * Save imported pens to the Store, optionally replacing existing data.
     */
    function saveImportedPens(pens, replaceExisting) {
        if (replaceExisting) {
            Store.savePens([]);
        }
        var saved = 0;
        pens.forEach(function (pen) {
            // Clean up internal fields
            delete pen._sourceFile;
            delete pen._selected;
            Store.addPen(pen);
            saved++;
        });
        return saved;
    }

    // --- Public API ---
    return {
        importFiles: importFiles,
        saveImportedPens: saveImportedPens,
        extractTextFromPDF: extractTextFromPDF,
        parseYardSheetRows: parseYardSheetRows
    };
})();
