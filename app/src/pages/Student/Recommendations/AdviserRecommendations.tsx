import { PersonSearch } from '@mui/icons-material';
import type { NavigationItem } from '../../../types/navigation';
import { adviserRecommendations } from '../../../data/recommendations';
import RecommendationSection from './RecommendationSection';

export const metadata: NavigationItem = {
    group: 'adviser-editor',
    index: 0,
    title: 'Adviser Recommendations',
    segment: 'adviser-recommendations',
    icon: <PersonSearch />,
    roles: ['student', 'admin'],
};

/**
 * Adviser recommendation hub for students, showing match scores, capacity, and expertise areas.
 */
export default function AdviserRecommendationsPage() {
    return (
        <RecommendationSection
            heading="Recommended Advisers"
            description="Curated matches based on your thesis topic, methodology preferences, and feedback turnaround goals."
            entries={adviserRecommendations}
        />
    );
}
