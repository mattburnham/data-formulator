// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as React from 'react';
import { useEffect } from 'react';

import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { Button, Paper } from '@mui/material';
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
        <Box sx={{ flexGrow: 1, bgcolor: 'background.paper', display: 'flex', height: 600, borderRadius: 2 }} >
            {/* Button navigation */}
            <Box sx={{ 
                minWidth: 180, 
                display: 'flex',
                flexDirection: 'column',
                borderRight: 1,
                borderColor: 'divider'
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
                        {title}
                    </Button>
                ))}
            </Box>

            {/* Content area */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
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

                        let content = <Paper variant="outlined" key={t.names.join("-")} sx={{width: 800, maxWidth: '100%', padding: "0px", marginBottom: "8px"}}>
                            <CustomReactTable rows={sampleRows} columnDefs={colDefs} rowsPerPageNum={-1} compact={false} />
                        </Paper>

                        return (
                            <Box key={j}>
                                <Typography variant="subtitle2" sx={{ mb: 1, fontSize: 12}} color="text.secondary">
                                    {table.url.split("/").pop()?.split(".")[0]}  ({Object.keys(t.rows[0]).length} columns{hideRowNum ? "" : ` ⨉ ${t.rows.length} rows`})
                                </Typography>
                                {content}
                            </Box>
                        )
                    });
                    
                    return (
                        <Box key={i}>
                            <Box sx={{mb: 1, gap: 1, maxWidth: 800, display: "flex", alignItems: "center"}}>
                                <Typography sx={{fontSize: 12}}>
                                    {dataset.description} <Typography variant="caption" sx={{color: "primary.light", fontSize: 10, mx: 0.5}}>[from {dataset.source}]</Typography> 
                                </Typography>
                                <Box sx={{marginLeft: "auto", flexShrink: 0}} >
                                    <Button size="small" variant="contained" 
                                            onClick={(event: React.MouseEvent<HTMLElement>) => {
                                                handleSelectDataset(dataset);
                                            }}>
                                        load dataset
                                    </Button>
                                </Box>
                            </Box>
                            {tableComponents}
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
}
