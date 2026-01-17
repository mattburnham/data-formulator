// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as React from 'react';
import { useState, useCallback, useEffect, useRef } from 'react';
import {
    Box,
    Button,
    Dialog,
    DialogContent,
    DialogTitle,
    IconButton,
    TextField,
    Typography,
    Tooltip,
    LinearProgress,
    Link,
    Input,
    alpha,
    useTheme,
    Divider,
} from '@mui/material';

import CloseIcon from '@mui/icons-material/Close';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import LinkIcon from '@mui/icons-material/Link';
import StorageIcon from '@mui/icons-material/Storage';
import ImageSearchIcon from '@mui/icons-material/ImageSearch';
import ExploreIcon from '@mui/icons-material/Explore';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Paper from '@mui/material/Paper';

import { useDispatch, useSelector } from 'react-redux';
import { DataFormulatorState, dfActions, fetchFieldSemanticType } from '../app/dfSlice';
import { AppDispatch } from '../app/store';
import { DictTable } from '../components/ComponentType';
import { createTableFromFromObjectArray, createTableFromText, loadTextDataWrapper, loadBinaryDataWrapper } from '../data/utils';
import { DataLoadingChat } from './DataLoadingChat';
import { DatasetSelectionView, DatasetMetadata } from './TableSelectionView';
import { getUrls } from '../app/utils';
import { CustomReactTable } from './ReactTable';
import { DBManagerPane } from './DBTableManager';

export type UploadTabType = 'menu' | 'upload' | 'paste' | 'url' | 'database' | 'extract' | 'explore';

interface TabPanelProps {
    children?: React.ReactNode;
    index: UploadTabType;
    value: UploadTabType;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`data-upload-tabpanel-${index}`}
            aria-labelledby={`data-upload-tab-${index}`}
            style={{ height: '100%', overflow: 'auto', boxSizing: 'border-box' }}
            {...other}
        >
            {value === index && children}
        </div>
    );
}

// Data source menu card component
interface DataSourceCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    onClick: () => void;
    disabled?: boolean;
    disabledReason?: string;
}

interface PreviewPanelProps {
    title: string;
    loading: boolean;
    error: string | null;
    table?: DictTable | null;
    tables?: DictTable[] | null;
    emptyLabel: string;
    meta?: string;
    onRemoveTable?: (index: number) => void;
}

const PreviewPanel: React.FC<PreviewPanelProps> = ({
    title,
    loading,
    error,
    table,
    tables,
    emptyLabel,
    meta,
    onRemoveTable,
}) => {
    const previewTables = tables ?? (table ? [table] : null);
    const [activeIndex, setActiveIndex] = useState(0);

    useEffect(() => {
        if (!previewTables || previewTables.length === 0) {
            setActiveIndex(0);
            return;
        }
        if (activeIndex > previewTables.length - 1) {
            setActiveIndex(previewTables.length - 1);
        }
    }, [previewTables, activeIndex]);

    const activeTable = previewTables && previewTables.length > 0 ? previewTables[activeIndex] : null;
    return (
        <Box
            sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                p: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                minHeight: 120,
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {title}
                </Typography>
                {onRemoveTable && previewTables && previewTables.length > 0 && (
                    <IconButton
                        size="small"
                        color="error"
                        onClick={() => onRemoveTable(activeIndex)}
                        sx={{ ml: 'auto' }}
                        aria-label="Remove table"
                    >
                        <DeleteIcon fontSize="small" />
                    </IconButton>
                )}
            </Box>

            {loading && <LinearProgress />}

            {error && (
                <Typography variant="caption" color="error">
                    {error}
                </Typography>
            )}

            {!loading && !error && (!previewTables || previewTables.length === 0) && (
                <Typography variant="caption" color="text.secondary">
                    {emptyLabel}
                </Typography>
            )}

            {previewTables && previewTables.length > 0 && (
                <Box>
                    {previewTables.length > 1 && (
                        <Box
                            sx={{
                                display: 'flex',
                                flexWrap: 'nowrap',
                                gap: 0.25,
                                mb: 0.5,
                                pb: 0.25,
                                overflowX: 'auto',
                                overflowY: 'hidden',
                                '&::-webkit-scrollbar': { height: 4 },
                                '&::-webkit-scrollbar-thumb': {
                                    backgroundColor: 'action.disabled',
                                    borderRadius: 4,
                                },
                            }}
                        >
                            {previewTables.map((t, idx) => {
                                const label = t.displayId || t.id;
                                return (
                                    <Tooltip key={`${t.id}-${idx}`} title={label} placement="top" arrow>
                                        <Button
                                            size="small"
                                            variant="text"
                                            onClick={() => setActiveIndex(idx)}
                                            sx={{
                                                textTransform: 'none',
                                                minWidth: 'auto',
                                                px: 1,
                                                py: 0.5,
                                                borderRadius: 1,
                                                borderBottom: '2px solid',
                                                borderBottomColor: idx === activeIndex ? (theme) => alpha(theme.palette.primary.main, 0.6) : 'transparent',
                                                backgroundColor: idx === activeIndex ? (theme) => alpha(theme.palette.primary.main, 0.08) : 'transparent',
                                                color: idx === activeIndex ? 'text.primary' : 'text.secondary',
                                                fontWeight: idx === activeIndex ? 600 : 500,
                                                fontSize: 12,
                                                lineHeight: 1.2,
                                                maxWidth: 160,
                                                overflow: 'hidden',
                                                '&:hover': {
                                                    backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.06),
                                                },
                                                '& .MuiButton-label': {
                                                    overflow: 'hidden',
                                                },
                                            }}
                                        >
                                            <Box
                                                component="span"
                                                sx={{
                                                    display: 'inline-block',
                                                    maxWidth: 140,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {label}
                                            </Box>
                                        </Button>
                                    </Tooltip>
                                );
                            })}
                        </Box>
                    )}

                    {activeTable && (
                        <Box sx={{ pb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                <Typography variant="caption" color="text.secondary">
                                    {activeTable.rows.length} rows × {activeTable.names.length} columns
                                    {previewTables && previewTables.length === 1
                                        ? ` • ${activeTable.displayId || activeTable.id}`
                                        : ''}
                                </Typography>
                            </Box>
                            <CustomReactTable
                                rows={activeTable.rows.slice(0, 12)}
                                columnDefs={activeTable.names.map(name => ({
                                    id: name,
                                    label: name,
                                    minWidth: 60,
                                }))}
                                rowsPerPageNum={-1}
                                compact={true}
                                isIncompleteTable={activeTable.rows.length > 12}
                                maxHeight={200}
                            />
                        </Box>
                    )}
                </Box>
            )}
        </Box>
    );
};

const DataSourceCard: React.FC<DataSourceCardProps> = ({ 
    icon, 
    title, 
    description, 
    onClick, 
    disabled = false,
    disabledReason 
}) => {
    const theme = useTheme();
    
    const card = (
        <Paper
            elevation={0}
            onClick={disabled ? undefined : onClick}
            sx={{
                p: 1.5,
                cursor: disabled ? 'not-allowed' : 'pointer',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                opacity: disabled ? 0.5 : 1,
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                '&:hover': disabled ? {} : {
                    borderColor: 'primary.main',
                    backgroundColor: alpha(theme.palette.primary.main, 0.04),
                }
            }}
        >
            <Box sx={{ 
                color: disabled ? 'text.disabled' : 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: 1,
                backgroundColor: alpha(theme.palette.primary.main, 0.08),
                flexShrink: 0,
                '& .MuiSvgIcon-root': { fontSize: 18 }
            }}>
                {icon}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography 
                    variant="body2" 
                    sx={{ 
                        fontWeight: 500,
                        color: disabled ? 'text.disabled' : 'text.primary',
                    }}
                >
                    {title}
                </Typography>
                <Typography
                    variant="caption"
                    sx={{
                        color: disabled ? 'text.disabled' : 'text.secondary',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        lineHeight: 1.3,
                        mt: 0.25,
                    }}
                >
                    {description}
                </Typography>
            </Box>
        </Paper>
    );

    if (disabled && disabledReason) {
        return (
            <Tooltip title={disabledReason} placement="top">
                <span>{card}</span>
            </Tooltip>
        );
    }

    return card;
};

const getUniqueTableName = (baseName: string, existingNames: Set<string>): string => {
    let uniqueName = baseName;
    let counter = 1;
    while (existingNames.has(uniqueName)) {
        uniqueName = `${baseName}_${counter}`;
        counter++;
    }
    return uniqueName;
};

export interface UnifiedDataUploadDialogProps {
    open: boolean;
    onClose: () => void;
    initialTab?: UploadTabType;
}

export const UnifiedDataUploadDialog: React.FC<UnifiedDataUploadDialogProps> = ({
    open,
    onClose,
    initialTab = 'menu',
}) => {
    const theme = useTheme();
    const dispatch = useDispatch<AppDispatch>();
    const existingTables = useSelector((state: DataFormulatorState) => state.tables);
    const serverConfig = useSelector((state: DataFormulatorState) => state.serverConfig);
    const dataCleanBlocks = useSelector((state: DataFormulatorState) => state.dataCleanBlocks);
    const existingNames = new Set(existingTables.map(t => t.id));

    const [activeTab, setActiveTab] = useState<UploadTabType>(initialTab === 'menu' ? 'menu' : initialTab);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Paste tab state
    const [pasteContent, setPasteContent] = useState<string>("");
    const [displayContent, setDisplayContent] = useState<string>("");
    const [isLargeContent, setIsLargeContent] = useState<boolean>(false);
    const [showFullContent, setShowFullContent] = useState<boolean>(false);
    const [isOverSizeLimit, setIsOverSizeLimit] = useState<boolean>(false);
    
    // URL input state (merged into file upload)
    const [tableURL, setTableURL] = useState<string>("");

    // File preview state (shared with URL)
    const [filePreviewTables, setFilePreviewTables] = useState<DictTable[] | null>(null);
    const [filePreviewLoading, setFilePreviewLoading] = useState<boolean>(false);
    const [filePreviewError, setFilePreviewError] = useState<string | null>(null);
    const [filePreviewFiles, setFilePreviewFiles] = useState<File[]>([]);

    // Sample datasets state
    const [datasetPreviews, setDatasetPreviews] = useState<DatasetMetadata[]>([]);

    // Constants
    const MAX_DISPLAY_LINES = 20;
    const LARGE_CONTENT_THRESHOLD = 50000;
    const MAX_CONTENT_SIZE = 2 * 1024 * 1024;

    // Update active tab when initialTab changes
    useEffect(() => {
        if (open) {
            setActiveTab(initialTab === 'menu' ? 'menu' : initialTab);
        }
    }, [initialTab, open]);


    // Load sample datasets
    useEffect(() => {
        if (open && activeTab === 'explore') {
            fetch(`${getUrls().EXAMPLE_DATASETS}`)
                .then((response) => response.json())
                .then((result) => {
                    let datasets: DatasetMetadata[] = result.map((info: any) => {
                        let tables = info["tables"].map((table: any) => {
                            if (table["format"] == "json") {
                                return {
                                    table_name: table["name"],
                                    url: table["url"],
                                    format: table["format"],
                                    sample: table["sample"],
                                }
                            }
                            else if (table["format"] == "csv" || table["format"] == "tsv") {
                                const delimiter = table["format"] === "csv" ? "," : "\t";
                                const rows = table["sample"]
                                    .split("\n")
                                    .map((row: string) => row.split(delimiter));
                                
                                if (rows.length > 0) {
                                    const headers = rows[0];
                                    const dataRows = rows.slice(1);
                                    const sampleData = dataRows.map((row: string[]) => {
                                        const obj: any = {};
                                        headers.forEach((header: string, index: number) => {
                                            obj[header] = row[index] || '';
                                        });
                                        return obj;
                                    });
                                    
                                    return {
                                        table_name: table["name"],
                                        url: table["url"],
                                        format: table["format"],
                                        sample: sampleData,
                                    };
                                }
                                
                                return {
                                    table_name: table["name"],
                                    url: table["url"],
                                    format: table["format"],
                                    sample: [],
                                };
                            }
                        })
                        return { tables: tables, name: info["name"], description: info["description"], source: info["source"] }
                    }).filter((t: DatasetMetadata | undefined) => t != undefined);
                    setDatasetPreviews(datasets);
                });
        }
    }, [open, activeTab]);

    const handleClose = useCallback(() => {
        // Reset state when closing
        setPasteContent("");
        setDisplayContent("");
        setIsLargeContent(false);
        setIsOverSizeLimit(false);
        setShowFullContent(false);
        setTableURL("");
        setFilePreviewTables(null);
        setFilePreviewLoading(false);
        setFilePreviewError(null);
        setFilePreviewFiles([]);
        onClose();
    }, [onClose]);

    // File upload handler
    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>): void => {
        const files = event.target.files;

        if (files && files.length > 0) {
            const selectedFiles = Array.from(files);
            setFilePreviewFiles(selectedFiles);
            setFilePreviewError(null);
            setFilePreviewTables(null);
            setFilePreviewLoading(true);
            // Clear URL input when file is uploaded
            setTableURL("");

            const MAX_FILE_SIZE = 5 * 1024 * 1024;
            const previewTables: DictTable[] = [];
            const errors: string[] = [];

            const processFiles = async () => {
                for (const file of selectedFiles) {
                    const uniqueName = getUniqueTableName(file.name, existingNames);
                    const isTextFile = file.type === 'text/csv' || 
                        file.type === 'text/tab-separated-values' || 
                        file.type === 'application/json' ||
                        file.name.endsWith('.csv') || 
                        file.name.endsWith('.tsv') || 
                        file.name.endsWith('.json');
                    const isExcelFile = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                        file.type === 'application/vnd.ms-excel' ||
                        file.name.endsWith('.xlsx') || 
                        file.name.endsWith('.xls');

                    if (file.size > MAX_FILE_SIZE && isTextFile) {
                        errors.push(`File ${file.name} is too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Use Database for large files.`);
                        continue;
                    }

                    if (isTextFile) {
                        try {
                            const text = await file.text();
                            const table = loadTextDataWrapper(uniqueName, text, file.type);
                            if (table) {
                                previewTables.push(table);
                            } else {
                                errors.push(`Failed to parse ${file.name}.`);
                            }
                        } catch {
                            errors.push(`Failed to read ${file.name}.`);
                        }
                        continue;
                    }

                    if (isExcelFile) {
                        try {
                            const arrayBuffer = await file.arrayBuffer();
                            const tables = await loadBinaryDataWrapper(uniqueName, arrayBuffer);
                            if (tables.length > 0) {
                                previewTables.push(...tables);
                            } else {
                                errors.push(`Failed to parse Excel file ${file.name}.`);
                            }
                        } catch {
                            errors.push(`Failed to parse Excel file ${file.name}.`);
                        }
                        continue;
                    }

                    errors.push(`Unsupported file format: ${file.name}.`);
                }

                setFilePreviewTables(previewTables.length > 0 ? previewTables : null);
                setFilePreviewError(errors.length > 0 ? errors.join(' ') : null);
                setFilePreviewLoading(false);
            };

            processFiles();
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleFileLoadSubmit = (): void => {
        if (!filePreviewTables || filePreviewTables.length === 0) {
            return;
        }
        for (let table of filePreviewTables) {
            dispatch(dfActions.loadTable(table));
            dispatch(fetchFieldSemanticType(table));
        }
        handleClose();
    };

    const handleRemoveFilePreviewTable = (index: number): void => {
        setFilePreviewTables((prev) => {
            if (!prev) return prev;
            const next = prev.filter((_, i) => i !== index);
            return next.length > 0 ? next : null;
        });
    };

    // Paste content handler
    const handleContentChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
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
    }, [showFullContent, MAX_CONTENT_SIZE]);

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

    const handlePasteSubmit = (): void => {
        let table: undefined | DictTable = undefined;
        
        const defaultName = (() => {
            const hashStr = pasteContent.substring(0, 100) + Date.now();
            const hashCode = hashStr.split('').reduce((acc, char) => {
                return ((acc << 5) - acc) + char.charCodeAt(0) | 0;
            }, 0);
            const shortHash = Math.abs(hashCode).toString(36).substring(0, 4);
            return `data-${shortHash}`;
        })();

        const uniqueName = getUniqueTableName(defaultName, existingNames);

        try {
            let content = JSON.parse(pasteContent);
            table = createTableFromFromObjectArray(uniqueName, content, true);
        } catch (error) {
            table = createTableFromText(uniqueName, pasteContent);
        }
        if (table) {
            dispatch(dfActions.loadTable(table));
            dispatch(fetchFieldSemanticType(table));
            handleClose();
        }
    };


    const handleURLPreview = (): void => {
        setFilePreviewLoading(true);
        setFilePreviewError(null);
        setFilePreviewTables(null);
        // Clear file preview when URL is loaded
        setFilePreviewFiles([]);

        let parts = tableURL.split('/');
        const baseName = parts[parts.length - 1] || 'dataset';
        const tableName = getUniqueTableName(baseName, existingNames);

        fetch(tableURL)
            .then(res => res.text())
            .then(content => {
                let table: undefined | DictTable = undefined;
                try {
                    let jsonContent = JSON.parse(content);
                    if (!Array.isArray(jsonContent)) {
                        throw new Error('JSON content must be an array of objects.');
                    }
                    table = createTableFromFromObjectArray(tableName, jsonContent, true);
                } catch (error) {
                    table = createTableFromText(tableName, content);
                }

                if (table) {
                    setFilePreviewTables([table]);
                } else {
                    setFilePreviewError('Unable to parse data from the provided URL.');
                }
            })
            .catch(() => {
                setFilePreviewError('Failed to fetch data from the URL.');
            })
            .finally(() => {
                setFilePreviewLoading(false);
            });
    };

    const hasValidUrlSuffix = tableURL.endsWith('.csv') || tableURL.endsWith('.tsv') || tableURL.endsWith(".json");
    const hasMultipleFileTables = (filePreviewTables?.length || 0) > 1;
    const showFilePreview = filePreviewLoading || !!filePreviewError || (filePreviewTables && filePreviewTables.length > 0);
    const hasPasteContent = pasteContent.trim() !== '';

    // Data source configurations for the menu
    const regularDataSources = [
        { 
            value: 'explore' as UploadTabType, 
            title: 'Sample Datasets', 
            description: 'Explore and load curated example datasets',
            icon: <ExploreIcon />, 
            disabled: false,
            disabledReason: undefined
        },
        { 
            value: 'upload' as UploadTabType, 
            title: 'Upload File', 
            description: 'Upload structured data (CSV, TSV, JSON, Excel) from files or URLs',
            icon: <UploadFileIcon />, 
            disabled: false,
            disabledReason: undefined
        },
        { 
            value: 'paste' as UploadTabType, 
            title: 'Paste Data', 
            description: 'Paste tabular data directly from clipboard',
            icon: <ContentPasteIcon />, 
            disabled: false,
            disabledReason: undefined
        },
        { 
            value: 'extract' as UploadTabType, 
            title: 'Extract from Documents', 
            description: 'Extract tables from images, PDFs, or documents using AI',
            icon: <ImageSearchIcon />, 
            disabled: false,
            disabledReason: undefined
        },
    ];

    const databaseDataSources = [
        { 
            value: 'database' as UploadTabType, 
            title: 'Database', 
            description: 'Connect to databases or data services',
            icon: <StorageIcon />, 
            disabled: serverConfig.DISABLE_DATABASE,
            disabledReason: 'Database connection is disabled in this environment'
        },
    ];

    // Combined config for finding tab titles
    const dataSourceConfig = [...regularDataSources, ...databaseDataSources];

    // Get current tab title for header
    const getCurrentTabTitle = () => {
        const tab = dataSourceConfig.find(t => t.value === activeTab);
        return tab?.title || 'Add Data';
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth={false}
            sx={{ 
                '& .MuiDialog-paper': { 
                    width: 1100,
                    maxWidth: '95vw',
                    height: 600, 
                    maxHeight: '90vh',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'width 0.2s ease',
                } 
            }}
        >
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
                {activeTab !== 'menu' && (
                    <IconButton
                        size="small"
                        onClick={() => setActiveTab('menu')}
                        sx={{ mr: 0.5 }}
                    >
                        <ArrowBackIcon fontSize="small" />
                    </IconButton>
                )}
                <Typography variant="h6" component="span">
                    {activeTab === 'menu' ? 'Add Data' : getCurrentTabTitle()}
                </Typography>
                {activeTab === 'extract' && dataCleanBlocks.length > 0 && (
                    <Tooltip title="Reset extraction">
                        <IconButton 
                            size="small" 
                            color='warning' 
                            sx={{
                                '&:hover': { 
                                    transform: 'rotate(180deg)', 
                                    transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)' 
                                } 
                            }} 
                            onClick={() => dispatch(dfActions.resetDataCleanBlocks())}
                        >
                            <RestartAltIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                )}
                <IconButton
                    sx={{ marginLeft: 'auto' }}
                    size="small"
                    onClick={handleClose}
                    aria-label="close"
                >
                    <CloseIcon fontSize="small" />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ flex: 1, overflow: 'hidden', p: 0 }}>
                {/* Main Menu */}
                <TabPanel value={activeTab} index="menu">
                    <Box sx={{ p: 2, boxSizing: 'border-box', width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <Box sx={{ 
                            width: '100%',
                            maxWidth: 860,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2,
                        }}>
                            {/* Regular Data Sources Group */}
                            <Box sx={{ 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                                gap: 1.5,
                            }}>
                                {regularDataSources.map((source) => (
                                    <DataSourceCard
                                        key={source.value}
                                        icon={source.icon}
                                        title={source.title}
                                        description={source.description}
                                        onClick={() => setActiveTab(source.value)}
                                        disabled={source.disabled}
                                        disabledReason={source.disabledReason}
                                    />
                                ))}
                            </Box>

                            {/* Divider */}
                            <Divider sx={{ my: 1 }} />

                            {/* Database Data Sources Group */}
                            <Box sx={{ 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                                gap: 1.5,
                            }}>
                                {databaseDataSources.map((source) => (
                                    <DataSourceCard
                                        key={source.value}
                                        icon={source.icon}
                                        title={source.title}
                                        description={source.description}
                                        onClick={() => setActiveTab(source.value)}
                                        disabled={source.disabled}
                                        disabledReason={source.disabledReason}
                                    />
                                ))}
                            </Box>
                        </Box>
                    </Box>
                </TabPanel>

                {/* Upload File Tab */}
                <TabPanel value={activeTab} index="upload">
                    <Box sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        height: '100%',
                        boxSizing: 'border-box',
                        gap: 2,
                        p: 2,
                        justifyContent: showFilePreview ? 'flex-start' : 'center',
                    }}>
                        <Box sx={{ width: '100%', maxWidth: showFilePreview ? '100%' : 760, alignSelf: 'center', display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Input
                            inputProps={{ 
                                accept: '.csv,.tsv,.json,.xlsx,.xls',
                                multiple: true,
                            }}
                            id="unified-upload-data-file"
                            type="file"
                            sx={{ display: 'none' }}
                            inputRef={fileInputRef}
                            onChange={handleFileUpload}
                        />
                        {serverConfig.DISABLE_FILE_UPLOAD ? (
                            <Box sx={{ textAlign: 'center', py: 4 }}>
                                <Typography color="text.secondary" sx={{ mb: 2 }}>
                                    File upload is disabled in this environment.
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Install Data Formulator locally to enable file upload. <br />
                                    <Link 
                                        href="https://github.com/microsoft/data-formulator" 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                    >
                                        https://github.com/microsoft/data-formulator
                                    </Link>
                                </Typography>
                            </Box>
                        ) : (
                            <Box sx={{ 
                                display: 'flex', 
                                flexDirection: showFilePreview ? 'row' : 'column',
                                gap: 2,
                                alignItems: showFilePreview ? 'flex-start' : 'stretch',
                            }}>
                                <Box
                                    sx={{
                                        border: '2px dashed',
                                        borderColor: 'divider',
                                        borderRadius: 2,
                                        p: showFilePreview ? 2 : 3,
                                        textAlign: 'center',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        flex: showFilePreview ? '0 0 45%' : '1',
                                        minWidth: showFilePreview ? 0 : 'auto',
                                        '&:hover': {
                                            borderColor: 'primary.main',
                                            backgroundColor: alpha(theme.palette.primary.main, 0.04),
                                        }
                                    }}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <UploadFileIcon sx={{ fontSize: showFilePreview ? 28 : 36, color: 'text.secondary', mb: 1 }} />
                                    <Typography variant={showFilePreview ? "body2" : "subtitle1"} gutterBottom>
                                        Drag & drop file here
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: showFilePreview ? '0.75rem' : '0.875rem' }}>
                                        or <Link component="button" sx={{ textDecoration: 'underline', cursor: 'pointer' }}>Browse</Link>
                                    </Typography>
                                    {!showFilePreview && (
                                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                            Supported: CSV, TSV, JSON, Excel (xlsx, xls)
                                        </Typography>
                                    )}
                                </Box>

                                {/* URL Input Section */}
                                <Box sx={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: 1,
                                    flex: showFilePreview ? '1' : '0 0 auto',
                                    minWidth: showFilePreview ? 0 : 'auto',
                                }}>
                                    <TextField
                                        fullWidth
                                        placeholder="Load a CSV, TSV, or JSON file from a URL, e.g. https://example.com/data.json"
                                        value={tableURL}
                                        onChange={(e) => setTableURL(e.target.value.trim())}
                                        error={tableURL !== "" && !hasValidUrlSuffix}
                                        size="small"
                                        sx={{ 
                                            flex: 1,
                                            '& .MuiInputBase-input': {
                                                fontSize: '0.75rem',
                                            },
                                            '& .MuiInputBase-input::placeholder': {
                                                fontSize: '0.75rem',
                                            },
                                        }}
                                    />
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        onClick={handleURLPreview}
                                        disabled={!hasValidUrlSuffix || filePreviewLoading}
                                        sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
                                    >
                                        Preview
                                    </Button>
                                </Box>
                            </Box>
                        )}

                        {showFilePreview && (
                            <PreviewPanel
                                title="Preview"
                                loading={filePreviewLoading}
                                error={filePreviewError}
                                tables={filePreviewTables}
                                emptyLabel={serverConfig.DISABLE_FILE_UPLOAD ? 'File upload is disabled.' : 'Select a file to preview.'}
                                meta={filePreviewTables && filePreviewTables.length > 0 ? `${filePreviewTables.length} table${filePreviewTables.length > 1 ? 's' : ''} previewed${hasMultipleFileTables ? ' • Multiple sheets detected' : ''}` : undefined}
                                onRemoveTable={handleRemoveFilePreviewTable}
                            />
                        )}

                        {filePreviewTables && filePreviewTables.length > 0 && (
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                                <Button
                                    variant="contained"
                                    size="small"
                                    onClick={handleFileLoadSubmit}
                                    disabled={serverConfig.DISABLE_FILE_UPLOAD || filePreviewLoading}
                                    sx={{ textTransform: 'none' }}
                                >
                                    {hasMultipleFileTables ? 'Load Tables' : 'Load Table'}
                                </Button>
                            </Box>
                        )}
                        </Box>
                    </Box>
                </TabPanel>

                {/* Paste Data Tab */}
                <TabPanel value={activeTab} index="paste">
                    <Box sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        height: '100%',
                        boxSizing: 'border-box',
                        p: 2,
                        justifyContent: hasPasteContent ? 'flex-start' : 'center',
                        alignItems: hasPasteContent ? 'stretch' : 'center',
                    }}>
                        {isOverSizeLimit && (
                            <Box sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                mb: 1, 
                                p: 1, 
                                backgroundColor: 'rgba(244, 67, 54, 0.1)', 
                                borderRadius: 1, 
                                border: '1px solid rgba(244, 67, 54, 0.3)' 
                            }}>
                                <Typography variant="caption" sx={{ flex: 1, color: 'error.main', fontWeight: 500 }}>
                                    ⚠️ Content exceeds {(MAX_CONTENT_SIZE / (1024 * 1024)).toFixed(0)}MB size limit. 
                                    Current size: {(new Blob([pasteContent]).size / (1024 * 1024)).toFixed(2)}MB. 
                                    Please use the DATABASE tab for large datasets.
                                </Typography>
                            </Box>
                        )}
                        
                        {isLargeContent && !isOverSizeLimit && (
                            <Box sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                mb: 1, 
                                p: 1, 
                                backgroundColor: 'rgba(255, 193, 7, 0.1)', 
                                borderRadius: 1 
                            }}>
                                <Typography variant="caption" sx={{ flex: 1 }}>
                                    Large content detected ({Math.round(pasteContent.length / 1000)}KB). 
                                    {showFullContent ? 'Showing full content (may be slow)' : 'Showing preview for performance'}
                                </Typography>
                                <Button 
                                    size="small" 
                                    variant="outlined" 
                                    onClick={toggleFullContent}
                                    sx={{ textTransform: 'none', minWidth: 'auto' }}
                                >
                                    {showFullContent ? 'Show Preview' : 'Show Full'}
                                </Button>
                            </Box>
                        )}

                        <Box sx={{ width: '100%', maxWidth: hasPasteContent ? 'none' : 720 }}>
                            <TextField
                                autoFocus
                                multiline
                                fullWidth
                                value={displayContent}
                                onChange={handleContentChange}
                                placeholder="Paste your data here (CSV, TSV, or JSON format)"
                                sx={{
                                    flex: hasPasteContent ? 1 : 'none',
                                    '& .MuiInputBase-root': {
                                        height: hasPasteContent ? '100%' : 220,
                                        alignItems: 'flex-start',
                                    },
                                    '& .MuiInputBase-input': {
                                        fontSize: 12,
                                        fontFamily: 'monospace',
                                        height: hasPasteContent ? '100% !important' : 'auto !important',
                                        overflow: 'auto !important',
                                    }
                                }}
                            />
                        </Box>

                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2, gap: 1 }}>
                            <Button
                                variant="contained"
                                onClick={handlePasteSubmit}
                                disabled={pasteContent.trim() === '' || isOverSizeLimit}
                                sx={{ textTransform: 'none' }}
                            >
                                Upload Data
                            </Button>
                        </Box>
                    </Box>
                </TabPanel>

                {/* Database Tab */}
                <TabPanel value={activeTab} index="database">
                    {serverConfig.DISABLE_DATABASE ? (
                        <Box sx={{ textAlign: 'center', py: 4, px: 2 }}>
                            <Typography color="text.secondary" sx={{ mb: 2 }}>
                                Database connection is disabled in this environment.
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Install Data Formulator locally to use database features. <br />
                                <Link 
                                    href="https://github.com/microsoft/data-formulator" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                >
                                    https://github.com/microsoft/data-formulator
                                </Link>
                            </Typography>
                        </Box>
                    ) : (
                        <DBManagerPane />
                    )}
                </TabPanel>

                {/* Extract Data Tab */}
                <TabPanel value={activeTab} index="extract">
                    <DataLoadingChat />
                </TabPanel>

                {/* Explore Sample Datasets Tab */}
                <TabPanel value={activeTab} index="explore">
                    <Box sx={{ p: 2 }}>
                        <DatasetSelectionView 
                        datasets={datasetPreviews} 
                        hideRowNum
                        handleSelectDataset={(dataset) => {
                            for (let table of dataset.tables) { 
                                fetch(table.url)
                                    .then(res => res.text())
                                    .then(textData => {
                                        let tableName = table.url.split("/").pop()?.split(".")[0] || 'table-' + Date.now().toString().substring(0, 8);
                                        let dictTable;
                                        if (table.format == "csv") {
                                            dictTable = createTableFromText(tableName, textData);
                                        } else if (table.format == "json") {
                                            dictTable = createTableFromFromObjectArray(tableName, JSON.parse(textData), true);
                                        } 
                                        if (dictTable) {
                                            dispatch(dfActions.loadTable(dictTable));
                                            dispatch(fetchFieldSemanticType(dictTable));
                                        }
                                    });
                            }
                            handleClose();
                        }}
                    />
                    </Box>
                </TabPanel>
            </DialogContent>
        </Dialog>
    );
};

export default UnifiedDataUploadDialog;
