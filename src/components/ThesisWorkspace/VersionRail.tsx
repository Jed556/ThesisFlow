import * as React from 'react';
import { Alert, Card, CardContent, Skeleton, Stack, Typography } from '@mui/material';
import { FileCard } from '../File';
import type { VersionOption } from '../../types/workspace';
import type { ConversationParticipant } from '../Conversation';
import { buildFileSizeLabel, buildSubmissionMeta, buildSubmissionStatusChip } from './ChapterRail';

interface VersionRailProps {
    versions: VersionOption[];
    selectedVersionIndex: number | null;
    onSelect: (version: number) => void;
    loading?: boolean;
    error?: string | null;
    enableUploads?: boolean;
    participants?: Record<string, ConversationParticipant>;
}

export const VersionRail: React.FC<VersionRailProps> = ({
    versions,
    selectedVersionIndex,
    onSelect,
    loading,
    error,
    enableUploads,
    participants,
}) => {
    if (loading) {
        return (
            <Stack spacing={1}>
                {Array.from({ length: 2 }).map((_, index) => (
                    <Skeleton key={index} variant="rounded" height={96} />
                ))}
            </Stack>
        );
    }

    if (error) {
        return (
            <Alert severity="error">{error}</Alert>
        );
    }

    if (versions.length === 0) {
        return (
            <Card variant="outlined">
                <CardContent>
                    <Typography variant="body2" color="text.secondary">
                        {enableUploads
                            ? 'No uploads yet. Submit a document to start tracking versions.'
                            : 'No uploaded versions yet.'}
                    </Typography>
                </CardContent>
            </Card>
        );
    }

    return (
        <Stack spacing={1}>
            {versions.map((version) => {
                const isActive = version.versionIndex === selectedVersionIndex;
                const { label: statusChipLabel, color: statusChipColor } = buildSubmissionStatusChip(version.status);
                return (
                    <FileCard
                        key={version.id}
                        file={version.file}
                        title={version.label}
                        sizeLabel={buildFileSizeLabel(version.file)}
                        metaLabel={buildSubmissionMeta(version.file, participants)}
                        versionLabel={`v${version.versionIndex + 1}`}
                        statusChipLabel={statusChipLabel}
                        statusChipColor={statusChipColor}
                        selected={isActive}
                        onClick={() => onSelect(version.versionIndex)}
                        showDeleteButton={false}
                    />
                );
            })}
        </Stack>
    );
};

export default VersionRail;
