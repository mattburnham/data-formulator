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
    DialogActions,
    IconButton,
    TextField,
    Typography,
    Tooltip,
    LinearProgress,
    Link,
    Input,
    alpha,
    useTheme,
} from '@mui/material';

import CloseIcon from '@mui/icons-material/Close';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import LinkIcon from '@mui/icons-material/Link';
import StorageIcon from '@mui/icons-material/Storage';
import ImageSearchIcon from '@mui/icons-material/ImageSearch';
import ExploreIcon from '@mui/icons-material/Explore';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteIcon from '@mui/icons-material/Delete';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import SearchIcon from '@mui/icons-material/Search';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';

import { useDispatch, useSelector } from 'react-redux';
import { DataFormulatorState, dfActions, fetchFieldSemanticType } from '../app/dfSlice';
import { AppDispatch } from '../app/store';
import { DictTable } from '../components/ComponentType';
import { createTableFromFromObjectArray, createTableFromText, loadTextDataWrapper, loadBinaryDataWrapper } from '../data/utils';
import { DataLoadingChat } from './DataLoadingChat';
import { DatasetSelectionView, DatasetMetadata } from './TableSelectionView';
import { getUrls } from '../app/utils';
import { CustomReactTable } from './ReactTable';
import { Type } from '../data/types';
import { TableStatisticsView, DataLoaderForm, handleDBDownload } from './DBTableManager';

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
                                {onRemoveTable && previewTables.length > 1 && (
                                    <IconButton
                                        size="small"
                                        color="error"
                                        onClick={() => onRemoveTable(activeIndex)}
                                        sx={{ ml: 'auto' }}
                                    >
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                )}
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
    
    // URL tab state
    const [tableURL, setTableURL] = useState<string>("");
    const [urlPreviewTable, setUrlPreviewTable] = useState<DictTable | null>(null);
    const [urlPreviewLoading, setUrlPreviewLoading] = useState<boolean>(false);
    const [urlPreviewError, setUrlPreviewError] = useState<string | null>(null);
    const [urlPreviewUrl, setUrlPreviewUrl] = useState<string>("");

    // File preview state
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

    useEffect(() => {
        if (tableURL !== urlPreviewUrl) {
            setUrlPreviewTable(null);
            setUrlPreviewError(null);
        }
    }, [tableURL, urlPreviewUrl]);

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
        setUrlPreviewTable(null);
        setUrlPreviewLoading(false);
        setUrlPreviewError(null);
        setUrlPreviewUrl("");
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

    // URL submit handler
    const handleURLSubmit = (): void => {
        if (urlPreviewTable && urlPreviewUrl === tableURL) {
            dispatch(dfActions.loadTable(urlPreviewTable));
            dispatch(fetchFieldSemanticType(urlPreviewTable));
            handleClose();
        }
    };

    const handleURLPreview = (): void => {
        setUrlPreviewLoading(true);
        setUrlPreviewError(null);
        setUrlPreviewTable(null);

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
                    setUrlPreviewTable(table);
                    setUrlPreviewUrl(tableURL);
                } else {
                    setUrlPreviewError('Unable to parse data from the provided URL.');
                }
            })
            .catch(() => {
                setUrlPreviewError('Failed to fetch data from the URL.');
            })
            .finally(() => {
                setUrlPreviewLoading(false);
            });
    };

    const hasValidUrlSuffix = tableURL.endsWith('.csv') || tableURL.endsWith('.tsv') || tableURL.endsWith(".json");
    const hasMultipleFileTables = (filePreviewTables?.length || 0) > 1;
    const showFilePreview = filePreviewLoading || !!filePreviewError || (filePreviewTables && filePreviewTables.length > 0);
    const showUrlPreview = urlPreviewLoading || !!urlPreviewError || (urlPreviewTable && urlPreviewUrl === tableURL);
    const hasPasteContent = pasteContent.trim() !== '';

    // Data source configurations for the menu
    const dataSourceConfig = [
        { 
            value: 'explore' as UploadTabType, 
            title: 'Sample Datasets', 
            description: 'Explore and load curated example datasets',
            icon: <ExploreIcon />, 
            disabled: false 
        },
        { 
            value: 'upload' as UploadTabType, 
            title: 'Upload File', 
            description: 'Upload CSV, TSV, JSON, or Excel files from your computer',
            icon: <UploadFileIcon />, 
            disabled: serverConfig.DISABLE_FILE_UPLOAD,
            disabledReason: 'File upload is disabled in this environment'
        },
        { 
            value: 'paste' as UploadTabType, 
            title: 'Paste Data', 
            description: 'Paste tabular data directly from clipboard',
            icon: <ContentPasteIcon />, 
            disabled: false 
        },
        { 
            value: 'url' as UploadTabType, 
            title: 'From URL', 
            description: 'Load data from a web URL (CSV, TSV, or JSON)',
            icon: <LinkIcon />, 
            disabled: false 
        },
        { 
            value: 'database' as UploadTabType, 
            title: 'Database', 
            description: 'Connect to databases or data services',
            icon: <StorageIcon />, 
            disabled: serverConfig.DISABLE_DATABASE,
            disabledReason: 'Database connection is disabled in this environment'
        },
        { 
            value: 'extract' as UploadTabType, 
            title: 'Extract from Documents', 
            description: 'Extract tables from images, PDFs, or documents using AI',
            icon: <ImageSearchIcon />, 
            disabled: false 
        },
    ];

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
                    width: activeTab === 'menu' ? 720 : 1100,
                    maxWidth: '95vw',
                    height: activeTab === 'menu' ? 'auto' : 700, 
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
                    <Box sx={{ p: 2 }}>
                        <Box sx={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                            gap: 1,
                        }}>
                            {dataSourceConfig.map((source) => (
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
                        justifyContent: 'center',
                    }}>
                        <Box sx={{ width: '100%', maxWidth: 760, alignSelf: 'center', display: 'flex', flexDirection: 'column', gap: 2 }}>
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
                            <Box
                                sx={{
                                    border: '2px dashed',
                                    borderColor: 'divider',
                                    borderRadius: 2,
                                    p: 3,
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    '&:hover': {
                                        borderColor: 'primary.main',
                                        backgroundColor: alpha(theme.palette.primary.main, 0.04),
                                    }
                                }}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <UploadFileIcon sx={{ fontSize: 36, color: 'text.secondary', mb: 1 }} />
                                <Typography variant="subtitle1" gutterBottom>
                                    Click to upload or drag and drop
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Supported formats: CSV, TSV, JSON, Excel (xlsx, xls)
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                    Maximum file size: 5MB (use Database tab for larger files)
                                </Typography>
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
                                    {hasMultipleFileTables ? 'Load Files' : 'Load File'}
                                </Button>
                            </Box>
                        )}
                        </Box>
                    </Box>
                </TabPanel>

                {/* URL Tab */}
                <TabPanel value={activeTab} index="url">
                    <Box sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        height: '100%',
                        boxSizing: 'border-box',
                        gap: 2,
                        p: 2,
                        justifyContent: 'center',
                    }}>
                        <Box sx={{ width: '100%', maxWidth: 760, alignSelf: 'center', display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <TextField
                                    fullWidth
                                    label="Data URL"
                                    placeholder="https://example.com/data.csv"
                                    value={tableURL}
                                    onChange={(e) => setTableURL(e.target.value.trim())}
                                    error={tableURL !== "" && !hasValidUrlSuffix}
                                    size="small"
                                />
                                <Button
                                    variant="outlined"
                                    size="small"
                                    onClick={handleURLPreview}
                                    disabled={!hasValidUrlSuffix || urlPreviewLoading}
                                    sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
                                >
                                    Preview
                                </Button>
                            </Box>

                            {tableURL !== "" && !hasValidUrlSuffix && (
                                <Typography variant="caption" color="error">
                                    URL should link to a .csv, .tsv, or .json file.
                                </Typography>
                            )}

                            <Typography variant="caption" color="text.secondary">
                                Supported URLs: direct links to .csv, .tsv, or .json files.
                            </Typography>

                            {showUrlPreview && (
                                <PreviewPanel
                                    title="Preview"
                                    loading={urlPreviewLoading}
                                    error={urlPreviewError}
                                    table={urlPreviewUrl === tableURL ? urlPreviewTable : null}
                                    emptyLabel="Click Preview to fetch a sample."
                                    meta={urlPreviewTable && urlPreviewUrl === tableURL ? `${urlPreviewTable.rows.length} rows × ${urlPreviewTable.names.length} columns` : undefined}
                                />
                            )}

                            {urlPreviewTable && urlPreviewUrl === tableURL && (
                                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                                    <Button
                                        variant="contained"
                                        size="small"
                                        onClick={handleURLSubmit}
                                        disabled={!hasValidUrlSuffix}
                                        sx={{ textTransform: 'none' }}
                                    >
                                        Load from URL
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
                        <DatabaseTabContent onClose={handleClose} />
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

interface DBTable {
    name: string;
    columns: { name: string; type: string; }[];
    row_count: number;
    sample_rows: any[];
    view_source: string | null;
}

interface ColumnStatistics {
    column: string;
    type: string;
    statistics: {
        count: number;
        unique_count: number;
        null_count: number;
        min?: number;
        max?: number;
        avg?: number;
    };
}

// Separate component for Database tab content
const DatabaseTabContent: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const theme = useTheme();
    const dispatch = useDispatch<AppDispatch>();
    const sessionId = useSelector((state: DataFormulatorState) => state.sessionId);
    const tables = useSelector((state: DataFormulatorState) => state.tables);
    const serverConfig = useSelector((state: DataFormulatorState) => state.serverConfig);

    const [dbTables, setDbTables] = React.useState<DBTable[]>([]);
    const [selectedTabKey, setSelectedTabKey] = React.useState("");
    const [isUploading, setIsUploading] = React.useState<boolean>(false);
    const [tableAnalysisMap, setTableAnalysisMap] = React.useState<Record<string, ColumnStatistics[] | null>>({});
    const [dataLoaderMetadata, setDataLoaderMetadata] = React.useState<Record<string, {
        params: {name: string, default: string, type: string, required: boolean, description: string}[], 
        auth_instructions: string}>>({});

    const setSystemMessage = (content: string, severity: "error" | "warning" | "info" | "success") => {
        dispatch(dfActions.addMessages({
            "timestamp": Date.now(),
            "component": "DB manager",
            "type": severity,
            "value": content
        }));
    };

    React.useEffect(() => {
        fetchTables();
        fetchDataLoaders();
    }, []);

    React.useEffect(() => {
        if (!selectedTabKey.startsWith("dataLoader:") && dbTables.length == 0) {
            setSelectedTabKey("");
        } else if (!selectedTabKey.startsWith("dataLoader:") && dbTables.find(t => t.name === selectedTabKey) == undefined) {
            if (dbTables.length > 0) {
                setSelectedTabKey(dbTables[0].name);
            }
        }
    }, [dbTables]);

    const fetchTables = async () => {
        if (serverConfig.DISABLE_DATABASE) return;
        try {
            const response = await fetch(getUrls().LIST_TABLES);
            const data = await response.json();
            if (data.status === 'success') {
                setDbTables(data.tables);
            }
        } catch (error) {
            setSystemMessage('Failed to fetch tables, please check if the server is running', "error");
        }
    };

    const fetchDataLoaders = async () => {
        fetch(getUrls().DATA_LOADER_LIST_DATA_LOADERS, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === "success") {
                setDataLoaderMetadata(data.data_loaders);
            }
        })
        .catch(error => {
            console.error('Failed to fetch data loader params:', error);
        });
    };

    const handleDBFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
    
        const formData = new FormData();
        formData.append('file', file);
        formData.append('table_name', file.name.split('.')[0]);
    
        try {
            setIsUploading(true);
            const response = await fetch(getUrls().CREATE_TABLE, {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            if (data.status === 'success') {
                if (data.is_renamed) {
                    setSystemMessage(`Table ${data.original_name} already exists. Renamed to ${data.table_name}`, "warning");
                } 
                fetchTables();
            } else {
                setSystemMessage(data.error || 'Failed to upload table', "error");
            }
        } catch (error) {
            setSystemMessage('Failed to upload table, please check if the server is running', "error");
        } finally {
            setIsUploading(false);
            if (event.target) {
                event.target.value = '';
            }
        }
    };

    const handleDropTable = async (tableName: string) => {
        if (tables.some(t => t.id === tableName)) {
            if (!confirm(`Are you sure you want to delete ${tableName}? \n ${tableName} is currently loaded and will be removed from the database.`)) return;
        }

        try {
            const response = await fetch(getUrls().DELETE_TABLE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ table_name: tableName })
            });
            const data = await response.json();
            if (data.status === 'success') {
                fetchTables();
                setSelectedTabKey(dbTables.length > 0 ? dbTables[0].name : "");
            } else {
                setSystemMessage(data.error || 'Failed to delete table', "error");
            }
        } catch (error) {
            setSystemMessage('Failed to delete table, please check if the server is running', "error");
        }
    };

    const handleAnalyzeData = async (tableName: string) => {
        if (!tableName) return;
        if (tableAnalysisMap[tableName]) return;
        
        try {
            const response = await fetch(getUrls().GET_COLUMN_STATS, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ table_name: tableName })
            });
            const data = await response.json();
            if (data.status === 'success') {
                setTableAnalysisMap(prevMap => ({
                    ...prevMap,
                    [tableName]: data.statistics
                }));
            }
        } catch (error) {
            setSystemMessage('Failed to analyze table data', "error");
        }
    };

    const toggleAnalysisView = (tableName: string) => {
        if (tableAnalysisMap[tableName]) {
            setTableAnalysisMap(prevMap => {
                const newMap = { ...prevMap };
                delete newMap[tableName];
                return newMap;
            });
        } else {
            handleAnalyzeData(tableName);
        }
    };

    const handleAddTableToDF = (dbTable: DBTable) => {
        const convertSqlTypeToAppType = (sqlType: string): Type => {
            sqlType = sqlType.toUpperCase();
            if (sqlType.includes('INT') || sqlType === 'BIGINT' || sqlType === 'SMALLINT' || sqlType === 'TINYINT') {
                return Type.Integer;
            } else if (sqlType.includes('FLOAT') || sqlType.includes('DOUBLE') || sqlType.includes('DECIMAL') || sqlType.includes('NUMERIC') || sqlType.includes('REAL')) {
                return Type.Number;
            } else if (sqlType.includes('BOOL')) {
                return Type.Boolean;
            } else if (sqlType.includes('DATE') || sqlType.includes('TIME') || sqlType.includes('TIMESTAMP')) {
                return Type.Date;
            } else {
                return Type.String;
            }
        };

        let table: DictTable = {
            id: dbTable.name,
            displayId: dbTable.name,
            names: dbTable.columns.map((col: any) => col.name),
            metadata: dbTable.columns.reduce((acc: Record<string, {type: Type, semanticType: string, levels: any[]}>, col: any) => ({
                ...acc,
                [col.name]: {
                    type: convertSqlTypeToAppType(col.type),
                    semanticType: "",
                    levels: []
                }
            }), {}),
            rows: dbTable.sample_rows,
            virtual: {
                tableId: dbTable.name,
                rowCount: dbTable.row_count,
            },
            anchored: true,
            createdBy: 'user',
            attachedMetadata: ''
        }
        dispatch(dfActions.loadTable(table));
        dispatch(fetchFieldSemanticType(table));
        onClose();
    };

    const handleCleanDerivedViews = async () => {
        let unreferencedViews = dbTables.filter(t => t.view_source !== null && t.view_source !== undefined && !tables.some(t2 => t2.id === t.name));

        if (unreferencedViews.length > 0) {
            if (confirm(`Are you sure you want to delete the following unreferenced derived views? \n${unreferencedViews.map(v => `- ${v.name}`).join("\n")}`)) {
                let deletedViews = [];
                for (let view of unreferencedViews) {
                    try {
                        const response = await fetch(getUrls().DELETE_TABLE, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ table_name: view.name })
                        });
                        const data = await response.json();
                        if (data.status === 'success') {
                            deletedViews.push(view.name);
                        }
                    } catch (error) {
                        setSystemMessage('Failed to delete table', "error");
                    }
                }
                if (deletedViews.length > 0) {
                    setSystemMessage(`Deleted ${deletedViews.length} unreferenced derived views`, "success");
                }
                fetchTables();
            }
        }
    };

    const handleDBReset = async () => {
        try {
            const response = await fetch(getUrls().RESET_DB_FILE, { method: 'POST' });
            const data = await response.json();
            if (data.status === 'success') {
                fetchTables();
            } else {
                setSystemMessage(data.error || 'Failed to reset database', "error");
            }
        } catch (error) {
            setSystemMessage('Failed to reset database', "error");
        }
    };

    const handleDBUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
    
        const formData = new FormData();
        formData.append('file', file);
    
        try {
            setIsUploading(true);
            const response = await fetch(getUrls().UPLOAD_DB_FILE, {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            if (data.status === 'success') {
                fetchTables();
            } else {
                setSystemMessage(data.error || 'Failed to upload database', "error");
            }
        } catch (error) {
            setSystemMessage('Failed to upload database', "error");
        } finally {
            setIsUploading(false);
        }
    };

    const hasDerivedViews = dbTables.filter(t => t.view_source !== null).length > 0;

    const dataLoaderPanel = (
        <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', backgroundColor: alpha(theme.palette.secondary.main, 0.02) }}>
            <Box sx={{ display: 'flex', alignItems: 'center', px: 1, mb: 1 }}>
                <Typography variant="caption" sx={{ color: "text.disabled", fontWeight: "500", flexGrow: 1, fontSize: "0.75rem" }}>
                    Data Connectors
                </Typography>
            </Box>
            
            {["file upload", ...Object.keys(dataLoaderMetadata ?? {})].map((dataLoaderType) => (
                <Button
                    key={`dataLoader:${dataLoaderType}`}
                    variant="text"
                    size="small"
                    onClick={() => setSelectedTabKey('dataLoader:' + dataLoaderType)}
                    color='secondary'
                    sx={{
                        textTransform: "none",
                        width: 120,
                        justifyContent: 'flex-start',
                        textAlign: 'left',
                        borderRadius: 0,
                        py: 0.5,
                        px: 2,
                        color: selectedTabKey === 'dataLoader:' + dataLoaderType ? 'secondary.main' : 'text.secondary',
                        borderRight: selectedTabKey === 'dataLoader:' + dataLoaderType ? 2 : 0,
                        borderColor: 'secondary.main',
                    }}
                >
                    <Typography fontSize='inherit' sx={{ textTransform: "none", width: "calc(100% - 4px)", textAlign: 'left', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {dataLoaderType}
                    </Typography>
                </Button>
            ))}
        </Box>
    );

    const tableSelectionPanel = (
        <Box sx={{ px: 0.5, pt: 1, display: 'flex', flexDirection: 'column', backgroundColor: alpha(theme.palette.primary.main, 0.02) }}>
            <Box sx={{ display: 'flex', alignItems: 'center', px: 1, mb: 1 }}>
                <Typography variant="caption" sx={{ color: "text.disabled", fontWeight: "500", flexGrow: 1, fontSize: "0.75rem" }}>
                    Data Tables
                </Typography>
                <Tooltip title="refresh the table list">
                    <IconButton size="small" color="primary" sx={{ '&:hover': { transform: 'rotate(180deg)' }, transition: 'transform 0.3s ease-in-out' }} onClick={fetchTables}>
                        <RefreshIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                </Tooltip>
            </Box>
            
            {dbTables.length == 0 && 
                <Typography variant="caption" sx={{ color: "lightgray", px: 2, py: 0.5, fontStyle: "italic" }}>
                    no tables available
                </Typography>
            }
            
            {dbTables.filter(t => t.view_source === null).map((t) => (
                <Button
                    key={t.name}
                    variant="text"
                    size="small"
                    color='primary'
                    onClick={() => setSelectedTabKey(t.name)}
                    sx={{
                        textTransform: "none",
                        width: 160,
                        justifyContent: 'flex-start',
                        textAlign: 'left',
                        borderRadius: 0,
                        py: 0.5,
                        px: 2,
                        color: selectedTabKey === t.name ? 'primary.main' : 'text.secondary',
                        borderRight: selectedTabKey === t.name ? 2 : 0,
                    }}
                >
                    <Typography fontSize='inherit' sx={{ width: "calc(100% - 4px)", textAlign: 'left', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {t.name}
                    </Typography>
                </Button>
            ))}
            
            {hasDerivedViews && (
                <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', px: 1, mb: 1 }}>
                        <Typography variant="caption" sx={{ color: "text.disabled", fontWeight: "500", flexGrow: 1, fontSize: "0.75rem" }}>
                            Derived Views
                        </Typography>
                        <Tooltip title="clean up unreferenced derived views">
                            <IconButton size="small" color="primary" disabled={dbTables.filter(t => t.view_source !== null).length === 0} onClick={handleCleanDerivedViews}>
                                <CleaningServicesIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                        </Tooltip>
                    </Box>
                    
                    {dbTables.filter(t => t.view_source !== null).map((t) => (
                        <Button
                            key={t.name}
                            variant="text"
                            size="small"
                            onClick={() => setSelectedTabKey(t.name)}
                            sx={{
                                textTransform: "none",
                                width: 160,
                                justifyContent: 'flex-start',
                                textAlign: 'left',
                                borderRadius: 0,
                                py: 0.5,
                                px: 2,
                                color: selectedTabKey === t.name ? 'primary.main' : 'text.secondary',
                                borderRight: selectedTabKey === t.name ? 2 : 0,
                            }}
                        >
                            <Typography fontSize='inherit' sx={{ width: "calc(100% - 4px)", textAlign: 'left', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                {t.name}
                            </Typography>
                        </Button>
                    ))}
                </Box>
            )}
        </Box>
    );

    const tableView = (
        <Box sx={{ flex: 1, minWidth: 0, overflow: 'auto', p: 2 }}>
            {selectedTabKey === '' && (
                <Typography variant="caption" sx={{ color: "text.secondary", px: 1 }}>
                    The database is empty, refresh the table list or import some data to get started.
                </Typography>
            )}
            
            {selectedTabKey === 'dataLoader:file upload' && (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
                    <Tooltip title="upload a csv/xlsx file to the local database">
                        <Button variant="outlined" component="label" disabled={isUploading}>
                            <UploadFileIcon sx={{ mr: 1 }} />
                            {isUploading ? 'Uploading...' : 'Upload CSV/XLSX to Database'}
                            <input type="file" hidden onChange={handleDBFileUpload} accept=".csv,.xlsx,.json" disabled={isUploading} />
                        </Button>
                    </Tooltip>
                    <Typography variant="caption" color="text.secondary">
                        Files uploaded here are stored in the database and can handle larger datasets
                    </Typography>
                </Box>
            )}
            
            {dataLoaderMetadata && Object.entries(dataLoaderMetadata).map(([dataLoaderType, metadata]) => (
                selectedTabKey === 'dataLoader:' + dataLoaderType && (
                    <Box key={`dataLoader:${dataLoaderType}`} sx={{ position: "relative", maxWidth: '100%' }}>
                        <DataLoaderForm 
                            key={`data-loader-form-${dataLoaderType}`}
                            dataLoaderType={dataLoaderType} 
                            paramDefs={metadata.params}
                            authInstructions={metadata.auth_instructions}
                            onImport={() => setIsUploading(true)} 
                            onFinish={(status, message, importedTables) => {
                                setIsUploading(false);
                                fetchTables().then(() => {
                                    if (status === "success" && importedTables && importedTables.length > 0) {
                                        setSelectedTabKey(importedTables[0]);
                                    }
                                });
                                if (status === "error") {
                                    setSystemMessage(message, "error");
                                }
                            }} 
                        />
                    </Box>
                )
            ))}
            
            {dbTables.map((t) => {
                if (selectedTabKey !== t.name) return null;
                
                const showingAnalysis = tableAnalysisMap[t.name] !== undefined;
                return (
                    <Box key={t.name} sx={{ maxWidth: '100%', overflowX: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Paper variant="outlined">
                            <Box sx={{ px: 1, display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
                                <Typography variant="caption">
                                    {showingAnalysis ? "column stats for " : "sample data from "} 
                                    <Typography component="span" sx={{ fontSize: 12, fontWeight: "bold" }}>{t.name}</Typography>
                                    <Typography component="span" sx={{ ml: 1, fontSize: 10, color: "text.secondary" }}>
                                        ({t.columns.length} columns × {t.row_count} rows)
                                    </Typography>
                                </Typography>
                                <Box sx={{ marginLeft: 'auto', display: 'flex', gap: 1 }}>
                                    <Button 
                                        size="small"
                                        color={showingAnalysis ? "secondary" : "primary"}
                                        onClick={() => toggleAnalysisView(t.name)}
                                        startIcon={<AnalyticsIcon fontSize="small" />}
                                        sx={{ textTransform: "none" }}
                                    >
                                        {showingAnalysis ? "show data samples" : "show column stats"}
                                    </Button>
                                    <IconButton size="small" color="error" onClick={() => handleDropTable(t.name)} title="Drop Table">
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </Box>
                            </Box>
                            {showingAnalysis ? (
                                <TableStatisticsView tableName={t.name} columnStats={tableAnalysisMap[t.name] ?? []} />
                            ) : (
                                <CustomReactTable 
                                    rows={t.sample_rows.map((row: any) => Object.fromEntries(Object.entries(row).map(([key, value]: [string, any]) => [key, String(value)]))).slice(0, 9)} 
                                    columnDefs={t.columns.map(col => ({ id: col.name, label: col.name, minWidth: 60 }))}
                                    rowsPerPageNum={-1}
                                    compact={false}
                                    isIncompleteTable={t.row_count > 10}
                                />
                            )}
                        </Paper>
                        <Button 
                            variant="contained"
                            size="small"
                            sx={{ ml: 'auto' }}
                            disabled={isUploading}
                            onClick={() => handleAddTableToDF(t)}
                        >
                            Load Table
                        </Button>
                    </Box>
                );
            })}
        </Box>
    );

    return (
        <Box sx={{ display: 'flex', flexDirection: 'row', height: '100%', position: 'relative' }}>
            {isUploading && (
                <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 255, 255, 0.7)', zIndex: 1000 }}>
                    <CircularProgress size={40} />
                </Box>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column', borderRight: 1, borderColor: 'divider' }}>
                <Box sx={{ minWidth: 180, display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', overflowY: 'auto', flexGrow: 1 }}>
                    {dataLoaderPanel}
                    {tableSelectionPanel}
                </Box>
                <Typography variant="caption" sx={{ mr: 'auto', mt: 'auto', mb: 1, px: 1, textWrap: 'wrap', '& .MuiButton-root': { minWidth: 'auto', textTransform: "none" } }}>
                    <Tooltip title="import a duckdb .db file">
                        <Button variant="text" size="small" component="label" disabled={isUploading}>
                            Import
                            <input type="file" hidden onChange={handleDBUpload} accept=".db" disabled={isUploading} />
                        </Button>
                    </Tooltip>
                    ,
                    <Tooltip title="save database to .db file">
                        <Button variant="text" size="small" onClick={() => handleDBDownload(sessionId ?? '')} disabled={isUploading || dbTables.length === 0}>
                            Export
                        </Button>
                    </Tooltip>
                    or
                    <Button variant="text" size="small" color="warning" onClick={handleDBReset} disabled={isUploading}>
                        Reset
                    </Button>
                </Typography>
            </Box>
            {tableView}
        </Box>
    );
};

export default UnifiedDataUploadDialog;
