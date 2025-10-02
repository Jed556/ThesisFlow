import { Edit } from '@mui/icons-material';
import type { NavigationItem } from '../../../types/navigation';
import { editorRecommendations } from '../../../data/recommendations';
import RecommendationSection from './RecommendationSection';

export const metadata: NavigationItem = {
    group: 'adviser-editor',
    index: 1,
    title: 'Editor',
    segment: 'editor-recommendations',
    icon: <Edit />,
    roles: ['student', 'admin'],
};

/**
 * Editor recommendation page presenting faculty who specialise in refinement and publication readiness.
 */
export default function EditorRecommendationsPage() {
    return (
        <RecommendationSection
            heading="Recommended Editors"
            description="Match with editors who can strengthen your manuscript structure, polish narratives, and accelerate publication timelines."
            entries={editorRecommendations}
        />
    );
}
