// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { useState, useCallback, useRef } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    IconButton,
    Typography,
    Box,
    TextField,
    Tabs,
    Tab,
    LinearProgress,
    Input,
    Alert,
    Tooltip,
    Link,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '../app/store';
import { DataFormulatorState, dfActions, dfSelectors, fetchFieldSemanticType } from '../app/dfSlice';
import { DictTable } from '../components/ComponentType';
import { createTableFromFromObjectArray, createTableFromText, loadTextDataWrapper, loadBinaryDataWrapper } from '../data/utils';
import { getUrls } from '../app/utils';

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;
    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`refresh-tabpanel-${index}`}
            aria-labelledby={`refresh-tab-${index}`}
            {...other}
        >
            {value === index && <Box sx={{ p: 2 }}>{children}</Box>}
        </div>
    );
}

export interface RefreshDataDialogProps {
    open: boolean;
    onClose: () => void;
    table: DictTable;
    onRefreshComplete: (newRows: any[]) => void;
}

export const RefreshDataDialog: React.FC<RefreshDataDialogProps> = ({
    open,
    onClose,
    table,
    onRefreshComplete,
}) => {
    const dispatch = useDispatch<AppDispatch>();
    const [tabValue, setTabValue] = useState(0);
    const [pasteContent, setPasteContent] = useState('');
    const [urlContent, setUrlContent] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const serverConfig = useSelector((state: DataFormulatorState) => state.serverConfig);

    // Constants for content size limits
    const MAX_DISPLAY_LINES = 20;
    const LARGE_CONTENT_THRESHOLD = 50000;
    const MAX_CONTENT_SIZE = 2 * 1024 * 1024; // 2MB

    const [displayContent, setDisplayContent] = useState('');
    const [isLargeContent, setIsLargeContent] = useState(false);
    const [showFullContent, setShowFullContent] = useState(false);
    const [isOverSizeLimit, setIsOverSizeLimit] = useState(false);

    const validateColumns = (newRows: any[]): { valid: boolean; message: string } => {
        if (!newRows || newRows.length === 0) {
            return { valid: false, message: 'No data found in the uploaded content.' };
        }

        const newColumns = Object.keys(newRows[0]).sort();
        const existingColumns = [...table.names].sort();

        if (newColumns.length !== existingColumns.length) {
            return {
                valid: false,
                message: `Column count mismatch. Expected ${existingColumns.length} columns (${existingColumns.join(', ')}), but got ${newColumns.length} columns (${newColumns.join(', ')}).`,
            };
        }

        const missingColumns = existingColumns.filter(col => !newColumns.includes(col));
        const extraColumns = newColumns.filter(col => !existingColumns.includes(col));

        if (missingColumns.length > 0 || extraColumns.length > 0) {
            let message = 'Column names do not match.';
            if (missingColumns.length > 0) {
                message += ` Missing: ${missingColumns.join(', ')}.`;
            }
            if (extraColumns.length > 0) {
                message += ` Unexpected: ${extraColumns.join(', ')}.`;
            }
            return { valid: false, message };
        }

        return { valid: true, message: '' };
    };

    const processAndValidateData = (newRows: any[]): boolean => {
        const validation = validateColumns(newRows);
        if (!validation.valid) {
            setError(validation.message);
            return false;
        }
        setError(null);
        onRefreshComplete(newRows);
        handleClose();
        return true;
    };

    const handleClose = () => {
        setPasteContent('');
        setUrlContent('');
        setDisplayContent('');
        setError(null);
        setIsLoading(false);
        setIsLargeContent(false);
        setShowFullContent(false);
        setIsOverSizeLimit(false);
        onClose();
    };

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
        setError(null);
    };

    // Handle paste content change with optimization for large content
    const handlePasteContentChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const newContent = event.target.value;
        setPasteContent(newContent);

        const contentSizeBytes = new Blob([newContent]).size;
        const isOverLimit = contentSizeBytes > MAX_CONTENT_SIZE;
        setIsOverSizeLimit(isOverLimit);

        const isLarge = newContent.length > LARGE_CONTENT_THRESHOLD;
        setIsLargeContent(isLarge);

        if (isLarge && !showFullContent) {
            const lines = newContent.split('\n');
            const previewLines = lines.slice(0, MAX_DISPLAY_LINES);
            const preview = previewLines.join('\n') + (lines.length > MAX_DISPLAY_LINES ? '\n... (truncated for performance)' : '');
            setDisplayContent(preview);
        } else {
            setDisplayContent(newContent);
        }
    }, [showFullContent]);

    const toggleFullContent = useCallback(() => {
        setShowFullContent(!showFullContent);
        if (!showFullContent) {
            setDisplayContent(pasteContent);
        } else {
            const lines = pasteContent.split('\n');
            const previewLines = lines.slice(0, MAX_DISPLAY_LINES);
            const preview = previewLines.join('\n') + (lines.length > MAX_DISPLAY_LINES ? '\n... (truncated for performance)' : '');
            setDisplayContent(preview);
        }
    }, [showFullContent, pasteContent]);

    // Handle paste submit
    const handlePasteSubmit = () => {
        if (!pasteContent.trim()) {
            setError('Please paste some data.');
            return;
        }

        setIsLoading(true);
        try {
            let newRows: any[] = [];
            try {
                const jsonContent = JSON.parse(pasteContent);
                if (Array.isArray(jsonContent)) {
                    newRows = jsonContent;
                } else {
                    setError('JSON content must be an array of objects.');
                    setIsLoading(false);
                    return;
                }
            } catch {
                // Try parsing as CSV/TSV
                const tempTable = createTableFromText('temp', pasteContent);
                if (tempTable) {
                    newRows = tempTable.rows;
                } else {
                    setError('Could not parse the pasted content as JSON or CSV/TSV.');
                    setIsLoading(false);
                    return;
                }
            }
            processAndValidateData(newRows);
        } catch (err) {
            setError('Failed to parse the pasted content.');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle URL submit
    const handleUrlSubmit = () => {
        if (!urlContent.trim()) {
            setError('Please enter a URL.');
            return;
        }

        const hasValidSuffix = urlContent.endsWith('.csv') || urlContent.endsWith('.tsv') || urlContent.endsWith('.json');
        if (!hasValidSuffix) {
            setError('URL must point to a .csv, .tsv, or .json file.');
            return;
        }

        setIsLoading(true);
        fetch(urlContent)
            .then(res => res.text())
            .then(content => {
                let newRows: any[] = [];
                try {
                    const jsonContent = JSON.parse(content);
                    if (Array.isArray(jsonContent)) {
                        newRows = jsonContent;
                    } else {
                        setError('JSON content must be an array of objects.');
                        setIsLoading(false);
                        return;
                    }
                } catch {
                    const tempTable = createTableFromText('temp', content);
                    if (tempTable) {
                        newRows = tempTable.rows;
                    } else {
                        setError('Could not parse the URL content as JSON or CSV/TSV.');
                        setIsLoading(false);
                        return;
                    }
                }
                processAndValidateData(newRows);
            })
            .catch(err => {
                setError(`Failed to fetch data from URL: ${err.message}`);
            })
            .finally(() => {
                setIsLoading(false);
            });
    };

    // Handle file upload
    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const file = files[0];
        setIsLoading(true);

        if (file.type === 'text/csv' ||
            file.type === 'text/tab-separated-values' ||
            file.type === 'application/json' ||
            file.name.endsWith('.csv') ||
            file.name.endsWith('.tsv') ||
            file.name.endsWith('.json')) {

            const MAX_FILE_SIZE = 5 * 1024 * 1024;
            if (file.size > MAX_FILE_SIZE) {
                setError(`File is too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Maximum size is 5MB.`);
                setIsLoading(false);
                return;
            }

            file.text().then((text) => {
                let newRows: any[] = [];
                try {
                    const jsonContent = JSON.parse(text);
                    if (Array.isArray(jsonContent)) {
                        newRows = jsonContent;
                    } else {
                        setError('JSON content must be an array of objects.');
                        setIsLoading(false);
                        return;
                    }
                } catch {
                    const tempTable = loadTextDataWrapper('temp', text, file.type);
                    if (tempTable) {
                        newRows = tempTable.rows;
                    } else {
                        setError('Could not parse the file content.');
                        setIsLoading(false);
                        return;
                    }
                }
                processAndValidateData(newRows);
            }).catch(err => {
                setError(`Failed to read file: ${err.message}`);
            }).finally(() => {
                setIsLoading(false);
            });
        } else if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            file.type === 'application/vnd.ms-excel' ||
            file.name.endsWith('.xlsx') ||
            file.name.endsWith('.xls')) {

            const reader = new FileReader();
            reader.onload = async (e) => {
                const arrayBuffer = e.target?.result as ArrayBuffer;
                if (arrayBuffer) {
                    try {
                        const tables = await loadBinaryDataWrapper('temp', arrayBuffer);
                        if (tables.length > 0) {
                            processAndValidateData(tables[0].rows);
                        } else {
                            setError('Failed to parse Excel file.');
                        }
                    } catch (err) {
                        setError('Failed to parse Excel file.');
                    }
                }
                setIsLoading(false);
            };
            reader.readAsArrayBuffer(file);
        } else {
            setError('Unsupported file format. Please use CSV, TSV, JSON, or Excel files.');
            setIsLoading(false);
        }

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const hasValidUrlSuffix = urlContent.endsWith('.csv') || urlContent.endsWith('.tsv') || urlContent.endsWith('.json');

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="md"
            fullWidth
            sx={{ '& .MuiDialog-paper': { minHeight: 400 } }}
        >
            <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
                Refresh Data for "{table.displayId || table.id}"
                <IconButton
                    sx={{ marginLeft: 'auto' }}
                    size="small"
                    onClick={handleClose}
                >
                    <CloseIcon fontSize="inherit" />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers>
                <Alert severity="info" sx={{ mb: 2, fontSize: 12 }}>
                    Upload new data to replace the current table content. The new data must have the same columns: <strong>{table.names.join(', ')}</strong>
                </Alert>

                {error && (
                    <Alert severity="error" sx={{ mb: 2, fontSize: 12 }}>
                        {error}
                    </Alert>
                )}

                {isLoading && <LinearProgress sx={{ mb: 2 }} />}

                <Tabs value={tabValue} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tab label="Paste Data" sx={{ textTransform: 'none', fontSize: 12 }} />
                    <Tab label="Upload File" sx={{ textTransform: 'none', fontSize: 12 }} />
                    <Tab label="From URL" sx={{ textTransform: 'none', fontSize: 12 }} />
                </Tabs>

                <TabPanel value={tabValue} index={0}>
                    {isOverSizeLimit && (
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, p: 1, backgroundColor: 'rgba(244, 67, 54, 0.1)', borderRadius: 1 }}>
                            <Typography variant="caption" sx={{ color: 'error.main' }}>
                                ⚠️ Content exceeds 2MB size limit.
                            </Typography>
                        </Box>
                    )}
                    {isLargeContent && !isOverSizeLimit && (
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, p: 1, backgroundColor: 'rgba(255, 193, 7, 0.1)', borderRadius: 1 }}>
                            <Typography variant="caption" sx={{ flex: 1 }}>
                                Large content detected. {showFullContent ? 'Showing full content' : 'Showing preview'}
                            </Typography>
                            <Button size="small" variant="outlined" onClick={toggleFullContent} sx={{ textTransform: 'none' }}>
                                {showFullContent ? 'Show Preview' : 'Show Full'}
                            </Button>
                        </Box>
                    )}
                    <TextField
                        fullWidth
                        multiline
                        minRows={8}
                        maxRows={15}
                        placeholder="Paste CSV, TSV, or JSON data here..."
                        value={displayContent}
                        onChange={handlePasteContentChange}
                        disabled={isLoading}
                        sx={{ '& .MuiInputBase-input': { fontSize: 12, fontFamily: 'monospace' } }}
                    />
                </TabPanel>

                <TabPanel value={tabValue} index={1}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                            Upload a CSV, TSV, JSON, or Excel file
                        </Typography>
                        <Input
                            inputProps={{ accept: '.csv,.tsv,.json,.xlsx,.xls' }}
                            type="file"
                            sx={{ display: 'none' }}
                            inputRef={fileInputRef}
                            onChange={handleFileUpload}
                        />
                        <Tooltip
                            title={serverConfig.DISABLE_FILE_UPLOAD ? (
                                <Typography sx={{ fontSize: '11px' }}>
                                    Install Data Formulator locally to enable file upload.
                                </Typography>
                            ) : ""}
                        >
                            <span>
                                <Button
                                    variant="contained"
                                    disabled={isLoading || serverConfig.DISABLE_FILE_UPLOAD}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    Choose File
                                </Button>
                            </span>
                        </Tooltip>
                    </Box>
                </TabPanel>

                <TabPanel value={tabValue} index={2}>
                    <TextField
                        fullWidth
                        placeholder="Enter URL to CSV, TSV, or JSON file"
                        value={urlContent}
                        onChange={(e) => setUrlContent(e.target.value.trim())}
                        disabled={isLoading}
                        error={urlContent !== '' && !hasValidUrlSuffix}
                        helperText={urlContent !== '' && !hasValidUrlSuffix ? 'URL should link to a .csv, .tsv, or .json file' : ''}
                        sx={{ '& .MuiInputBase-input': { fontSize: 12 } }}
                    />
                </TabPanel>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} disabled={isLoading}>
                    Cancel
                </Button>
                {tabValue === 0 && (
                    <Button
                        variant="contained"
                        onClick={handlePasteSubmit}
                        disabled={isLoading || !pasteContent.trim() || isOverSizeLimit}
                    >
                        Refresh Data
                    </Button>
                )}
                {tabValue === 2 && (
                    <Button
                        variant="contained"
                        onClick={handleUrlSubmit}
                        disabled={isLoading || !urlContent.trim() || !hasValidUrlSuffix}
                    >
                        Refresh Data
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
};
