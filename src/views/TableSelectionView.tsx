// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as React from 'react';
import { useEffect } from 'react';

import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { Button, Card, Paper, Chip } from '@mui/material';
import StreamIcon from '@mui/icons-material/Stream';
import { CustomReactTable } from './ReactTable';
import { createTableFromFromObjectArray } from '../data/utils';

// Update the interface to support multiple tables per dataset
export interface DatasetMetadata {
    name: string;
    description: string;
    source: string;
    tables: {
        table_name: string;
        url: string;
        format: string;
        sample: any[];
    }[];
    // Live/streaming dataset properties
    live?: boolean;
    refreshIntervalSeconds?: number;
}

export interface DatasetSelectionViewProps {
    datasets: DatasetMetadata[];
    handleSelectDataset: (datasetMetadata: DatasetMetadata) => void;
    hideRowNum?: boolean;
}


export const DatasetSelectionView: React.FC<DatasetSelectionViewProps> = function DatasetSelectionView({ datasets, handleSelectDataset, hideRowNum  }) {

    const [selectedDatasetName, setSelectedDatasetName] = React.useState<string | undefined>(undefined);

    useEffect(() => {
        if (datasets.length > 0) {
            setSelectedDatasetName(datasets[0].name);
        }
    }, [datasets]);

    const handleDatasetSelect = (index: number) => {
        setSelectedDatasetName(datasets[index].name);
    };

    let datasetTitles : string[] = [];
    for (let i = 0; i < datasets.length; i ++) {
        let k = 0;
        let title = datasets[i].name;
        while (datasetTitles.includes(title)) {
            k = k + 1;
            title = `${title}_${k}`;
        }
        datasetTitles.push(title);
    }

    return (
        <Box sx={{ bgcolor: 'background.paper', display: 'flex', height: '100%', borderRadius: 2, overflow: 'hidden' }} >
            {/* Button navigation */}
            <Box sx={{ 
                minWidth: 180,
                maxWidth: 180,
                width: 180,
                display: 'flex',
                flexDirection: 'column',
                borderRight: 1,
                borderColor: 'divider',
                overflow: 'hidden',
                height: '100%'
            }}>
                <Box sx={{ 
                    display: 'flex',
                    flexDirection: 'column',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    flex: 1,
                    minHeight: 0,
                    height: '100%',
                    position: 'relative',
                    overscrollBehavior: 'contain'
                }}>
                    {datasetTitles.map((title, i) => (
                        <Button
                            key={i}
                            variant="text"
                            size="small"
                            color='primary'
                            onClick={() => handleDatasetSelect(i)}
                            sx={{
                                fontSize: 12,
                                textTransform: "none",
                                width: 180,
                                justifyContent: 'flex-start',
                                textAlign: 'left',
                                borderRadius: 0,
                                py: 1,
                                px: 2,
                                color: selectedDatasetName === title ? 'primary.main' : 'text.secondary',
                                borderRight: selectedDatasetName === title ? 2 : 0,
                                borderColor: 'primary.main',
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                {datasets[i]?.live && (
                                    <StreamIcon sx={{ fontSize: 14, color: 'success.main' }} />
                                )}
                                <span>{title}</span>
                            </Box>
                        </Button>
                    ))}
                </Box>
            </Box>

            {/* Content area */}
            <Box sx={{ flex: 1, overflow: 'hidden', minWidth: 0, minHeight: 0, height: '100%', position: 'relative' }}>
                <Box sx={{ height: '100%', overflowY: 'auto', overflowX: 'hidden', p: 2, minWidth: 0, overscrollBehavior: 'contain' }}>
                    {datasets.map((dataset, i) => {
                        if (dataset.name !== selectedDatasetName) return null;

                        let tableComponents = dataset.tables.map((table, j) => {
                            let t = createTableFromFromObjectArray(table.table_name, table.sample, true);
                            let maxDisplayRows = dataset.tables.length > 1 ? 5 : 9;
                            if (t.rows.length < maxDisplayRows) {
                                maxDisplayRows = t.rows.length - 1;
                            }
                            let sampleRows = [
                                ...t.rows.slice(0,maxDisplayRows), 
                                Object.fromEntries(t.names.map(n => [n, "..."]))
                            ];
                            let colDefs = t.names.map(name => { return {
                                id: name, label: name, minWidth: 60, align: undefined, format: (v: any) => v,
                            }})

                            return (
                                <Box key={j}>
                                    <Typography variant="subtitle2" sx={{ mb: 1, fontSize: 12}} color="text.secondary">
                                        {table.url.split("/").pop()?.split(".")[0]}  ({Object.keys(t.rows[0]).length} columns{hideRowNum ? "" : ` ⨉ ${t.rows.length} rows`})
                                    </Typography>
                                    <Box sx={{ maxWidth: '100%', overflowX: 'auto', display: 'flex', flexDirection: 'column', mb: 1 }}>
                                        <Card variant="outlined" sx={{
                                            width: 800, minWidth: 'fit-content', padding: "0px"}}>
                                            <CustomReactTable rows={sampleRows} columnDefs={colDefs} rowsPerPageNum={-1} compact={false} />
                                        </Card>
                                    </Box>
                                </Box>
                            )
                        });
                        
                        // Format refresh interval for display
                        const formatRefreshInterval = (seconds: number) => {
                            if (seconds < 60) return `${seconds}s`;
                            if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
                            return `${Math.floor(seconds / 3600)}h`;
                        };
                        
                        return (
                            <Box key={i}>
                                <Box sx={{mb: 1, gap: 1, maxWidth: 800, display: "flex", alignItems: "center", flexWrap: "wrap"}}>
                                    <Typography sx={{fontSize: 12, flex: 1, minWidth: 200}}>
                                        {dataset.description} <Typography variant="caption" sx={{color: "primary.light", fontSize: 10, mx: 0.5}}>[from {dataset.source}]</Typography>
                                    </Typography>
                                    {dataset.live && dataset.refreshIntervalSeconds && (
                                        <Chip 
                                            icon={<StreamIcon sx={{ fontSize: 14 }} />}
                                            label={`Auto-refresh: ${formatRefreshInterval(dataset.refreshIntervalSeconds)}`}
                                            size="small"
                                            color="success"
                                            variant="outlined"
                                            sx={{ fontSize: 10, height: 22 }}
                                        />
                                    )}
                                    <Box sx={{marginLeft: "auto", flexShrink: 0}} >
                                        <Button size="small" variant="contained" 
                                                onClick={(event: React.MouseEvent<HTMLElement>) => {
                                                    handleSelectDataset(dataset);
                                                }}>
                                            {dataset.live ? 'load live data' : 'load dataset'}
                                        </Button>
                                    </Box>
                                </Box>
                                {tableComponents}
                            </Box>
                        );
                    })}
                </Box>
            </Box>
        </Box>
    );
}
